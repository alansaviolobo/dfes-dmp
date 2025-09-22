#!/usr/bin/env python3
"""
Goa land ownership statistics
Input: `./src/goa-plot-info/goa_plot_info.csv` csv file with columns:
- taluka
- village
- survey
- kide
- bhunaksha area
- ror area
- owners raw
- owners
- blank
- comunidade

Operations:
- Data validation
    Non numeric values in ror area and bhunaksha area
    Missing or invalid ownership info in "owners raw"
- Data conversion
    ror_area_int and bhunaksha_area_int
    ror_bhunaksha_area_diff_pct calculation
Output:
- Summary statistics (CSV file)
  - Taluk wise plot info summary of total area, bhunaksha area, comunidade area, tenanted area and with pct
  - Tauk-Village wise plot info summary
  - RoR-Bhunaksha area difference percentage in all outputs
"""

import pandas as pd
import numpy as np
import re
import sys
import os
from pathlib import Path
import json


def clean_multiline_csv(file_path):
    """
    Clean CSV file with multi-line entries in the 'Owners Raw' field.
    The CSV has multi-line entries where the "Owners Raw" field contains newlines.
    """
    print(f"Cleaning multi-line CSV entries in: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    output_lines = []
    current_row = []
    in_multiline_field = False
    multiline_content = []
    
    for line in lines:
        if not in_multiline_field:
            # Check if this line starts a multi-line field (has odd number of quotes)
            quote_count = line.count('"')
            if quote_count % 2 == 1:
                in_multiline_field = True
                multiline_content = [line]
            else:
                # Regular line, add to output
                if line.strip():
                    output_lines.append(line)
        else:
            # We're in a multi-line field
            multiline_content.append(line)
            quote_count = line.count('"')
            if quote_count % 2 == 1:
                # This line ends the multi-line field
                in_multiline_field = False
                # Join the multiline content and add to output
                joined_line = ' '.join(multiline_content)
                output_lines.append(joined_line)
                multiline_content = []
    
    # Create temporary cleaned file
    temp_file = file_path.replace('.csv', '_cleaned.csv')
    with open(temp_file, 'w', encoding='utf-8') as f:
        for line in output_lines:
            f.write(line + '\n')
    
    return temp_file


def parse_owners_raw_field(owners_raw_text):
    """
    Parse the 'Owners Raw' field to extract occupants, tenants, and remarks.
    
    Returns:
        dict: {
            'occupant_count': int,
            'occupant_names': list,
            'tenant_count': int, 
            'tenant_names': list,
            'remarks': str
        }
    """
    if pd.isna(owners_raw_text) or not isinstance(owners_raw_text, str):
        return {
            'occupant_count': 0,
            'occupant_names': [],
            'tenant_count': 0,
            'tenant_names': [],
            'remarks': ''
        }
    
    text = owners_raw_text.strip()
    
    # Initialize result
    result = {
        'occupant_count': 0,
        'occupant_names': [],
        'tenant_count': 0,
        'tenant_names': [],
        'remarks': ''
    }
    
    # Use regex to find occupants and tenants sections
    # Look for "Occupants Names :" followed by content
    occupants_match = re.search(r'Occupants Names\s*:\s*(.+?)(?=Tenants\s+names\s*:|Total Area\s*:|-------|---------|\Z)', text, re.DOTALL | re.IGNORECASE)
    tenants_match = re.search(r'Tenants\s+names\s*:\s*(.+?)(?=Total Area\s*:|-------|---------|\Z)', text, re.DOTALL | re.IGNORECASE)
    
    # Extract occupants
    if occupants_match:
        occupants_text = occupants_match.group(1).strip()
        
        # Handle numbered lists (1)., 2)., etc.) or simple names
        if re.search(r'\d+\)\.\s*', occupants_text):
            # Split by numbered items
            occupant_parts = re.split(r'\d+\)\.\s*', occupants_text)
        else:
            # Simple list, try splitting by common separators
            occupant_parts = [occupants_text]
        
        occupant_names = []
        for part in occupant_parts:
            part = part.strip()
            if part:
                # Remove prefixes like %, #, etc. and clean the name
                cleaned_name = re.sub(r'^[%#&*!@$^()]+\s*', '', part).strip()
                # Remove trailing punctuation and special chars
                cleaned_name = re.sub(r'[,\s\n\r]+$', '', cleaned_name).strip()
                # Remove internal newlines and excess spaces
                cleaned_name = re.sub(r'\s+', ' ', cleaned_name)
                # Skip 'nil' or similar placeholder values (case-insensitive)
                if cleaned_name and cleaned_name.lower() not in ['nil', 'null', 'none', 'na', 'n/a', '-'] and cleaned_name not in occupant_names:
                    occupant_names.append(cleaned_name)
        
        result['occupant_names'] = occupant_names
        result['occupant_count'] = len(occupant_names)
    
    # Extract tenants
    if tenants_match:
        tenants_text = tenants_match.group(1).strip()
        
        # Handle numbered lists (1)., 2)., etc.) first, then fallback to comma/semicolon separation
        if re.search(r'\d+\)\.\s*', tenants_text):
            # Split by numbered items
            tenant_parts = re.split(r'\d+\)\.\s*', tenants_text)
        else:
            # Split by commas or common separators
            tenant_parts = re.split(r'[,;]\s*|\s+and\s+', tenants_text)
        
        tenant_names = []
        
        for part in tenant_parts:
            part = part.strip()
            if part:
                # Remove prefixes and clean the name
                cleaned_name = re.sub(r'^[%#&*!@$^()]+\s*', '', part).strip()
                cleaned_name = re.sub(r'[,\s\n\r]+$', '', cleaned_name).strip()
                # Remove internal newlines and excess spaces
                cleaned_name = re.sub(r'\s+', ' ', cleaned_name)
                # Skip 'nil' or similar placeholder values (case-insensitive)
                if cleaned_name and cleaned_name.lower() not in ['nil', 'null', 'none', 'na', 'n/a', '-'] and cleaned_name not in tenant_names:
                    tenant_names.append(cleaned_name)
        
        result['tenant_names'] = tenant_names
        result['tenant_count'] = len(tenant_names)
    
    # Extract remarks - everything that's not standard fields
    remarks_parts = []
    
    # Remove standard fields and content we've already extracted
    text_for_remarks = text
    
    # Remove standard field patterns
    standard_patterns = [
        r'Taluka Name\s*:[^:]*?(?=\s+Village Name|Subdiv No|Occupants Names|Tenants\s+names|Total Area|\Z)',
        r'Village Name\s*:[^:]*?(?=\s+Subdiv No|Occupants Names|Tenants\s+names|Total Area|\Z)', 
        r'Subdiv No\s*:[^:]*?(?=\s+Occupants Names|Tenants\s+names|Total Area|\Z)',
        r'Total Area\s*:[^:]*?(?=\s*[-=]{3,}|\Z)',
        r'Occupants Names\s*:.*?(?=Tenants\s+names\s*:|Total Area\s*:|-------|---------|\Z)',
        r'Tenants\s+names\s*:.*?(?=Total Area\s*:|-------|---------|\Z)',
        r'[-=]{3,}',
        r'^\s*$'
    ]
    
    for pattern in standard_patterns:
        text_for_remarks = re.sub(pattern, '', text_for_remarks, flags=re.DOTALL | re.IGNORECASE | re.MULTILINE)
    
    # Clean up the remaining text
    text_for_remarks = re.sub(r'\n+', ' ', text_for_remarks)
    text_for_remarks = re.sub(r'\s+', ' ', text_for_remarks)
    text_for_remarks = text_for_remarks.strip()
    
    result['remarks'] = text_for_remarks
    
    return result


def load_and_validate_data(file_path):
    """
    Load CSV data and perform validation and cleaning.
    """
    print(f"Loading data from: {file_path}")
    
    # Clean the CSV first
    cleaned_file = clean_multiline_csv(file_path)
    
    try:
        # Load the cleaned CSV
        df = pd.read_csv(cleaned_file, encoding='utf-8')
        print(f"Loaded {len(df)} records")
        
        # Clean up temporary file
        os.remove(cleaned_file)
        
    except Exception as e:
        print(f"Error loading CSV: {e}")
        # Try with different encoding
        try:
            df = pd.read_csv(cleaned_file, encoding='latin-1')
            print(f"Loaded {len(df)} records with latin-1 encoding")
            os.remove(cleaned_file)
        except Exception as e2:
            print(f"Error with latin-1 encoding: {e2}")
            return None
    
    # Display column info
    print(f"Columns: {list(df.columns)}")
    print(f"Data types:\n{df.dtypes}")
    
    # Data validation and cleaning
    print("\nPerforming data validation...")
    
    # Clean taluka names (handle case-insensitive column names)
    taluka_col = 'Taluka' if 'Taluka' in df.columns else 'taluka'
    df[taluka_col] = df[taluka_col].astype(str).str.strip()
    
    # Convert area columns to numeric, handling non-numeric values
    for col in ['Bhunaksha Area', 'RoR Area']:
        if col in df.columns:
            # Remove non-numeric characters except decimal point
            df[f'{col}_clean'] = df[col].astype(str).str.replace(r'[^0-9.]', '', regex=True)
            df[f'{col}_clean'] = pd.to_numeric(df[f'{col}_clean'], errors='coerce').fillna(0)
            print(f"Converted {col}: {df[f'{col}_clean'].isna().sum()} invalid values set to 0")
    
    # Calculate area difference percentage
    bhunaksha_area_col = 'Bhunaksha Area_clean' if 'Bhunaksha Area_clean' in df.columns else 'Bhunaksha Area'
    ror_area_col = 'RoR Area_clean' if 'RoR Area_clean' in df.columns else 'RoR Area'
    
    if bhunaksha_area_col in df.columns and ror_area_col in df.columns:
        # Calculate percentage difference: (RoR - Bhunaksha) / Bhunaksha * 100
        df['ror_bhunaksha_area_diff_pct'] = np.where(
            df[bhunaksha_area_col] > 0,
            ((df[ror_area_col] - df[bhunaksha_area_col]) / df[bhunaksha_area_col] * 100).round(2),
            0
        )
        print(f"Calculated RoR-Bhunaksha area difference percentage")
    else:
        df['ror_bhunaksha_area_diff_pct'] = 0
        print("Warning: Could not calculate area difference percentage - missing area columns")
    
    # Check for comunidade plots based on 'Owners Raw' containing comunidade variations
    comunidade_variations = [
        'Comminidade', 'Commmunidade', 'Commnnidade', 'Commnunidade', 'Commonidade',
        'Commudade', 'Commudidade', 'Commuidade', 'Commundade', 'Commundiade',
        'Communiade', 'Communicade', 'Communid', 'Communida', 'Communidad',
        'Communidad3e', 'Communidada', 'Communidade', 'Communidadee', 'Communidae',
        'Communidaede', 'Communidasde', 'Communiddade', 'Communidde', 'Communide',
        'Communidede', 'Communindade', 'Communnidade', 'Communudade', 'Comuidade',
        'Comundiade', 'Comuniade', 'Comunidad', 'Comunidade', 'Comunidae'
    ]
    
    if 'Owners Raw' in df.columns:
        # Create a pattern to match any of the comunidade variations (case-insensitive)
        comunidade_pattern = '|'.join(comunidade_variations)
        df['is_comunidade'] = df['Owners Raw'].astype(str).str.contains(
            comunidade_pattern, case=False, na=False, regex=True
        )
        print(f"Identified {df['is_comunidade'].sum()} comunidade plots based on 'Owners Raw' containing comunidade variations")
    elif 'Communidade' in df.columns:
        # Fallback to existing Communidade column if available
        df['is_comunidade'] = df['Communidade'].astype(str).str.upper() == 'TRUE'
        print(f"Using existing 'Communidade' column: {df['is_comunidade'].sum()} comunidade plots")
    else:
        # If no Owners Raw or Communidade column, we'll set all to False
        df['is_comunidade'] = False
        print("No comunidade plots identified (no 'Owners Raw' or 'Communidade' column found)")
    
    # Parse detailed information from 'Owners Raw' field first to get tenant_count
    if 'Owners Raw' in df.columns:
        print("\nParsing detailed information from 'Owners Raw' field...")
        
        # Apply the parsing function to each row
        parsed_data = df['Owners Raw'].apply(parse_owners_raw_field)
        
        # Extract individual components into separate columns
        df['occupant_count'] = parsed_data.apply(lambda x: x['occupant_count'])
        df['occupant_names'] = parsed_data.apply(lambda x: json.dumps(x['occupant_names'], ensure_ascii=False) if x['occupant_names'] else '[]')
        df['tenant_count'] = parsed_data.apply(lambda x: x['tenant_count'])
        df['tenant_names'] = parsed_data.apply(lambda x: json.dumps(x['tenant_names'], ensure_ascii=False) if x['tenant_names'] else '[]')
        df['remarks'] = parsed_data.apply(lambda x: x['remarks'])
        
        print(f"Parsed occupant information for {df['occupant_count'].sum():,} total occupants")
        print(f"Parsed tenant information for {df['tenant_count'].sum():,} total tenants")
        print(f"Extracted remarks for {(df['remarks'] != '').sum():,} records")
        
        # Use tenant_count to determine if plot is tenanted
        df['is_tenanted'] = df['tenant_count'] > 0
        print(f"Identified {df['is_tenanted'].sum()} tenanted plots based on actual tenant count > 0")
    elif 'Tenanted' in df.columns:
        # Fallback to existing Tenanted column if available
        df['is_tenanted'] = df['Tenanted'].astype(str).str.upper() == 'TRUE'
        print(f"Using existing 'Tenanted' column: {df['is_tenanted'].sum()} tenanted plots")
        # Set default values for parsed fields
        df['occupant_count'] = 0
        df['occupant_names'] = '[]'
        df['tenant_count'] = 0
        df['tenant_names'] = '[]'
        df['remarks'] = ''
    else:
        # If no tenanted column or Owners Raw, we'll set all to False
        df['is_tenanted'] = False
        print("No tenanted plots identified (no 'Owners Raw' or 'Tenanted' column found)")
        # Set default values for parsed fields
        df['occupant_count'] = 0
        df['occupant_names'] = '[]'
        df['tenant_count'] = 0
        df['tenant_names'] = '[]'
        df['remarks'] = ''
    
    # Check for government plots based on 'Owners Raw' containing government-related keywords
    government_keywords = [
        'government', 'govt', 'railway', ' rly ', 'block  ', 'forest',
        ' engineer', 'officer', 'department', 'ministry','division'
    ]
    
    if 'Owners Raw' in df.columns:
        # Create a pattern to match any of the government keywords (case-insensitive)
        government_pattern = '|'.join([re.escape(keyword) for keyword in government_keywords])
        df['is_government'] = df['Owners Raw'].astype(str).str.contains(
            government_pattern, case=False, na=False, regex=True
        )
        print(f"Identified {df['is_government'].sum()} government plots based on 'Owners Raw' containing government keywords")
    else:
        # If no Owners Raw column, we'll set all to False
        df['is_government'] = False
        print("No government plots identified (no 'Owners Raw' column found)")
    
    # Drop duplicate rows
    df.drop_duplicates(inplace=True)
    print(f"Removed duplicates, {len(df)} records remaining")
    
    return df


def generate_taluka_summary(df):
    """
    Generate taluka-wise summary statistics.
    """
    print("\nGenerating taluka-wise summary...")
    
    # Get the correct column names
    taluka_col = 'Taluka' if 'Taluka' in df.columns else 'taluka'
    ror_area_col = 'RoR Area_clean' if 'RoR Area_clean' in df.columns else 'RoR Area'
    bhunaksha_area_col = 'Bhunaksha Area_clean' if 'Bhunaksha Area_clean' in df.columns else 'Bhunaksha Area'
    
    # Group by taluka
    taluka_summary = df.groupby(taluka_col).agg({
        ror_area_col: ['count', 'sum'],
        'is_comunidade': 'sum',
        'is_tenanted': 'sum',
        'is_government': 'sum',
        'occupant_count': 'sum',
        'tenant_count': 'sum'
    }).round(2)
    
    # Flatten column names
    taluka_summary.columns = ['total_records', 'total_ror_area', 'comunidade_records', 'tenanted_records', 'government_records', 'total_occupants', 'total_tenants']
    
    # Add bhunaksha area if available
    if bhunaksha_area_col in df.columns:
        bhunaksha_areas = df.groupby(taluka_col)[bhunaksha_area_col].sum()
        taluka_summary['total_bhunaksha_area'] = taluka_summary.index.map(bhunaksha_areas).fillna(0)
    else:
        taluka_summary['total_bhunaksha_area'] = 0
    
    # Calculate comunidade, tenanted, and government areas
    comunidade_areas = df[df['is_comunidade']].groupby(taluka_col)[ror_area_col].sum()
    tenanted_areas = df[df['is_tenanted']].groupby(taluka_col)[ror_area_col].sum()
    government_areas = df[df['is_government']].groupby(taluka_col)[ror_area_col].sum()
    
    taluka_summary['comunidade_area'] = taluka_summary.index.map(comunidade_areas).fillna(0)
    taluka_summary['tenanted_area'] = taluka_summary.index.map(tenanted_areas).fillna(0)
    taluka_summary['government_area'] = taluka_summary.index.map(government_areas).fillna(0)
    
    # Calculate percentages
    taluka_summary['comunidade_pct'] = (taluka_summary['comunidade_area'] / taluka_summary['total_ror_area'] * 100).round(2)
    taluka_summary['tenanted_pct'] = (taluka_summary['tenanted_area'] / taluka_summary['total_ror_area'] * 100).round(2)
    taluka_summary['government_pct'] = (taluka_summary['government_area'] / taluka_summary['total_ror_area'] * 100).round(2)
    
    # Calculate RoR-Bhunaksha area difference percentage
    taluka_summary['ror_bhunaksha_area_diff_pct'] = np.where(
        taluka_summary['total_bhunaksha_area'] > 0,
        ((taluka_summary['total_ror_area'] - taluka_summary['total_bhunaksha_area']) / taluka_summary['total_bhunaksha_area'] * 100).round(2),
        0
    )
    
    # Add hectares
    taluka_summary['total_ror_area_hectares'] = (taluka_summary['total_ror_area'] / 10000).round(2)
    taluka_summary['total_bhunaksha_area_hectares'] = (taluka_summary['total_bhunaksha_area'] / 10000).round(2)
    taluka_summary['comunidade_area_hectares'] = (taluka_summary['comunidade_area'] / 10000).round(2)
    taluka_summary['tenanted_area_hectares'] = (taluka_summary['tenanted_area'] / 10000).round(2)
    taluka_summary['government_area_hectares'] = (taluka_summary['government_area'] / 10000).round(2)
    
    # Reset index to get Taluka as a column
    taluka_summary = taluka_summary.reset_index()
    
    # Reorder columns to match specified format
    column_order = [
        taluka_col, 'total_ror_area', 'total_records', 'tenanted_records', 'comunidade_records', 'government_records',
        'total_occupants', 'total_tenants',
        'total_ror_area_hectares', 'tenanted_area_hectares', 'comunidade_area_hectares', 'government_area_hectares',
        'tenanted_pct', 'comunidade_pct', 'government_pct', 'total_bhunaksha_area_hectares', 'ror_bhunaksha_area_diff_pct'
    ]
    
    # Only include columns that exist in the dataframe
    existing_columns = [col for col in column_order if col in taluka_summary.columns]
    taluka_summary = taluka_summary[existing_columns]
    
    return taluka_summary


def generate_taluka_village_summary(df):
    """
    Generate taluka-village wise summary statistics.
    """
    print("\nGenerating taluka-village wise summary...")
    
    # Get the correct column names
    taluka_col = 'Taluka' if 'Taluka' in df.columns else 'taluka'
    village_col = 'Village' if 'Village' in df.columns else 'village'
    ror_area_col = 'RoR Area_clean' if 'RoR Area_clean' in df.columns else 'RoR Area'
    bhunaksha_area_col = 'Bhunaksha Area_clean' if 'Bhunaksha Area_clean' in df.columns else 'Bhunaksha Area'
    
    # Group by taluka and village
    taluka_village_summary = df.groupby([taluka_col, village_col]).agg({
        ror_area_col: ['count', 'sum'],
        'is_comunidade': 'sum',
        'is_tenanted': 'sum',
        'is_government': 'sum',
        'occupant_count': 'sum',
        'tenant_count': 'sum'
    }).round(2)
    
    # Flatten column names
    taluka_village_summary.columns = ['total_records', 'total_ror_area', 'comunidade_records', 'tenanted_records', 'government_records', 'total_occupants', 'total_tenants']
    
    # Add bhunaksha area if available
    if bhunaksha_area_col in df.columns:
        bhunaksha_areas = df.groupby([taluka_col, village_col])[bhunaksha_area_col].sum()
        taluka_village_summary['total_bhunaksha_area'] = taluka_village_summary.index.map(bhunaksha_areas).fillna(0)
    else:
        taluka_village_summary['total_bhunaksha_area'] = 0
    
    # Calculate comunidade, tenanted, and government areas
    comunidade_areas = df[df['is_comunidade']].groupby([taluka_col, village_col])[ror_area_col].sum()
    tenanted_areas = df[df['is_tenanted']].groupby([taluka_col, village_col])[ror_area_col].sum()
    government_areas = df[df['is_government']].groupby([taluka_col, village_col])[ror_area_col].sum()
    
    taluka_village_summary['comunidade_area'] = taluka_village_summary.index.map(comunidade_areas).fillna(0)
    taluka_village_summary['tenanted_area'] = taluka_village_summary.index.map(tenanted_areas).fillna(0)
    taluka_village_summary['government_area'] = taluka_village_summary.index.map(government_areas).fillna(0)
    
    # Calculate percentages
    taluka_village_summary['comunidade_pct'] = (taluka_village_summary['comunidade_area'] / taluka_village_summary['total_ror_area'] * 100).round(2)
    taluka_village_summary['tenanted_pct'] = (taluka_village_summary['tenanted_area'] / taluka_village_summary['total_ror_area'] * 100).round(2)
    taluka_village_summary['government_pct'] = (taluka_village_summary['government_area'] / taluka_village_summary['total_ror_area'] * 100).round(2)
    
    # Calculate RoR-Bhunaksha area difference percentage
    taluka_village_summary['ror_bhunaksha_area_diff_pct'] = np.where(
        taluka_village_summary['total_bhunaksha_area'] > 0,
        ((taluka_village_summary['total_ror_area'] - taluka_village_summary['total_bhunaksha_area']) / taluka_village_summary['total_bhunaksha_area'] * 100).round(2),
        0
    )
    
    # Add hectares
    taluka_village_summary['total_ror_area_hectares'] = (taluka_village_summary['total_ror_area'] / 10000).round(2)
    taluka_village_summary['total_bhunaksha_area_hectares'] = (taluka_village_summary['total_bhunaksha_area'] / 10000).round(2)
    taluka_village_summary['comunidade_area_hectares'] = (taluka_village_summary['comunidade_area'] / 10000).round(2)
    taluka_village_summary['tenanted_area_hectares'] = (taluka_village_summary['tenanted_area'] / 10000).round(2)
    taluka_village_summary['government_area_hectares'] = (taluka_village_summary['government_area'] / 10000).round(2)
    
    # Reset index to get Taluka and Village as columns
    taluka_village_summary = taluka_village_summary.reset_index()
    
    # Reorder columns to match specified format
    column_order = [
        taluka_col, village_col, 'total_ror_area', 'total_records', 'tenanted_records', 'comunidade_records', 'government_records',
        'total_occupants', 'total_tenants',
        'total_ror_area_hectares', 'tenanted_area_hectares', 'comunidade_area_hectares', 'government_area_hectares',
        'tenanted_pct', 'comunidade_pct', 'government_pct', 'total_bhunaksha_area_hectares', 'ror_bhunaksha_area_diff_pct'
    ]
    
    # Only include columns that exist in the dataframe
    existing_columns = [col for col in column_order if col in taluka_village_summary.columns]
    taluka_village_summary = taluka_village_summary[existing_columns]
    
    return taluka_village_summary


def print_overall_summary(df):
    """
    Print overall summary statistics.
    """
    print("\n" + "="*50)
    print("OVERALL SUMMARY")
    print("="*50)
    
    # Get the correct column names
    ror_area_col = 'RoR Area_clean' if 'RoR Area_clean' in df.columns else 'RoR Area'
    bhunaksha_area_col = 'Bhunaksha Area_clean' if 'Bhunaksha Area_clean' in df.columns else 'Bhunaksha Area'
    
    total_ror_area = df[ror_area_col].sum()
    total_bhunaksha_area = df[bhunaksha_area_col].sum() if bhunaksha_area_col in df.columns else 0
    total_comunidade_records = df['is_comunidade'].sum()
    total_comunidade_area = df[df['is_comunidade']][ror_area_col].sum()
    total_tenanted_records = df['is_tenanted'].sum()
    total_tenanted_area = df[df['is_tenanted']][ror_area_col].sum()
    total_government_records = df['is_government'].sum()
    total_government_area = df[df['is_government']][ror_area_col].sum()
    total_occupants = df['occupant_count'].sum()
    total_tenants = df['tenant_count'].sum()
    total_with_remarks = (df['remarks'] != '').sum()
    
    print(f"Total Records: {len(df):,}")
    print(f"Total RoR Area: {total_ror_area:,.2f} sq.m ({total_ror_area/10000:,.2f} hectares)")
    print(f"Total Bhunaksha Area: {total_bhunaksha_area:,.2f} sq.m ({total_bhunaksha_area/10000:,.2f} hectares)")
    print(f"Total Communidade Records: {total_comunidade_records:,}")
    print(f"Total Communidade RoR Area: {total_comunidade_area:,.2f} sq.m ({total_comunidade_area/10000:,.2f} hectares)")
    print(f"Total Tenanted Records: {total_tenanted_records:,}")
    print(f"Total Tenanted RoR Area: {total_tenanted_area:,.2f} sq.m ({total_tenanted_area/10000:,.2f} hectares)")
    print(f"Total Government Records: {total_government_records:,}")
    print(f"Total Government RoR Area: {total_government_area:,.2f} sq.m ({total_government_area/10000:,.2f} hectares)")
    print(f"Total Occupants: {total_occupants:,}")
    print(f"Total Tenants: {total_tenants:,}")
    print(f"Records with Remarks: {total_with_remarks:,}")
    
    if total_ror_area > 0:
        print(f"Communidade Percentage of Total Area: {(total_comunidade_area/total_ror_area)*100:.2f}%")
        print(f"Tenanted Percentage of Total Area: {(total_tenanted_area/total_ror_area)*100:.2f}%")
        print(f"Government Percentage of Total Area: {(total_government_area/total_ror_area)*100:.2f}%")
    
    if total_bhunaksha_area > 0:
        ror_bhunaksha_diff_pct = ((total_ror_area - total_bhunaksha_area) / total_bhunaksha_area * 100)
        print(f"RoR-Bhunaksha Area Difference Percentage: {ror_bhunaksha_diff_pct:.2f}%")


def print_top_talukas(df, n=10):
    """
    Print top N talukas by area.
    """
    print(f"\n" + "="*50)
    print(f"TOP {n} TALUKAS BY TOTAL AREA")
    print("="*50)
    
    # Get the correct column names
    taluka_col = 'Taluka' if 'Taluka' in df.columns else 'taluka'
    ror_area_col = 'RoR Area_clean' if 'RoR Area_clean' in df.columns else 'RoR Area'
    
    taluka_areas = df.groupby(taluka_col)[ror_area_col].sum().sort_values(ascending=False)
    
    for i, (taluka, area) in enumerate(taluka_areas.head(n).items(), 1):
        print(f"{i:2d}. {taluka}: {area:,.2f} sq.m ({area/10000:,.2f} hectares)")
    
    print(f"\n" + "="*50)
    print(f"TOP {n} TALUKAS BY COMMUNIDADE AREA")
    print("="*50)
    
    comunidade_areas = df[df['is_comunidade']].groupby(taluka_col)[ror_area_col].sum().sort_values(ascending=False)
    
    for i, (taluka, area) in enumerate(comunidade_areas.head(n).items(), 1):
        print(f"{i:2d}. {taluka}: {area:,.2f} sq.m ({area/10000:,.2f} hectares)")


def main():
    """
    Main function to run the analysis.
    """
    # Default input file
    default_file = "./src/dharani.csv"
    
    # Check if input file is provided as command line argument
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = default_file
    
    # Check if file exists
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found!")
        print(f"Usage: {sys.argv[0]} [input_csv_file]")
        print(f"Example: {sys.argv[0]} {default_file}")
        sys.exit(1)
    
    print(f"Analyzing CSV file: {input_file}")
    print("="*50)
    
    # Load and validate data
    df = load_and_validate_data(input_file)
    if df is None:
        print("Failed to load data. Exiting.")
        sys.exit(1)
    
    # Generate summaries
    taluka_summary = generate_taluka_summary(df)
    taluka_village_summary = generate_taluka_village_summary(df)
    
    # Print summaries
    print_overall_summary(df)
    print_top_talukas(df)
    
    # Save results to CSV files
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    
    taluka_summary.to_csv(output_dir / "taluka_summary.csv", index=False)
    taluka_village_summary.to_csv(output_dir / "taluka_village_summary.csv", index=False)
    
    # Create detailed output with all the parsed fields
    detailed_columns = [
        'Taluka', 'Village', 'Survey', 'Kide', 'Bhunaksha Area', 'RoR Area',
        'is_comunidade', 'is_tenanted', 'is_government',
        'occupant_count', 'occupant_names', 'tenant_count', 'tenant_names', 'remarks',
        'ror_bhunaksha_area_diff_pct'
    ]
    
    # Only include columns that exist in the dataframe
    existing_detailed_columns = [col for col in detailed_columns if col in df.columns]
    detailed_df = df[existing_detailed_columns].copy()
    detailed_df.to_csv(output_dir / "detailed_plot_analysis.csv", index=False)
    
    # Create a remarks analysis file for easy review
    remarks_df = df[df['remarks'] != ''][['Taluka', 'Village', 'Survey', 'Kide', 'remarks']].copy()
    if len(remarks_df) > 0:
        remarks_df.to_csv(output_dir / "remarks_analysis.csv", index=False)
    
    # Create dharani-analyzed.csv with all original columns plus the new analysis fields
    dharani_columns = [
        'Taluka', 'Village', 'Survey', 'Kide', 'Bhunaksha Area', 'RoR Area', 'Owners Raw', 'Owners',
        'is_comunidade', 'is_government', 'is_tenanted', 'occupant_count', 'tenant_count', 'remark_count'
    ]
    
    # Calculate remark_count (number of characters in remarks, 0 if empty)
    df['remark_count'] = df['remarks'].apply(lambda x: len(x.strip()) if isinstance(x, str) and x.strip() else 0)
    
    # Rename is_government to is_govt for the export
    dharani_df = df.copy()
    dharani_df['is_govt'] = dharani_df['is_government']
    
    # Update column list to use is_govt
    dharani_columns = [col.replace('is_government', 'is_govt') for col in dharani_columns]
    
    # Only include columns that exist in the dataframe
    existing_dharani_columns = [col for col in dharani_columns if col in dharani_df.columns]
    dharani_export_df = dharani_df[existing_dharani_columns].copy()
    dharani_export_df.to_csv(output_dir / "dharani-analyzed.csv", index=False)
    
    print(f"\n" + "="*50)
    print("SUMMARY FILES SAVED")
    print("="*50)
    print(f"Taluka summary: {output_dir / 'taluka_summary.csv'}")
    print(f"Taluka-Village summary: {output_dir / 'taluka_village_summary.csv'}")
    print(f"Detailed analysis: {output_dir / 'detailed_plot_analysis.csv'}")
    print(f"Dharani analyzed: {output_dir / 'dharani-analyzed.csv'} ({len(dharani_export_df):,} records)")
    if len(remarks_df) > 0:
        print(f"Remarks analysis: {output_dir / 'remarks_analysis.csv'} ({len(remarks_df):,} records with remarks)")
    
    print("\nAnalysis complete!")


if __name__ == "__main__":
    main()
