#
# Use this script to download the Local Government Directory data by state
# From the daily LGD archive https://ramseraph.github.io/opendata/lgd/
# 
# Special thanks to @ramseraph for the daily LGD dumps  
# Data docs: https://ramseraph.github.io/opendata/lgd/anatomy
#
# Data Source: https://lgdirectory.gov.in
# Local Government Directory
# Ministry of Panchayati Raj
# Government of India
#
# Usage Examples:
# python3 1_filter_lgd_by_state.py                    # Default: Kerala (state code 32)
# python3 1_filter_lgd_by_state.py --state-code 30 --state-name goa
# python3 1_filter_lgd_by_state.py --state-code 28 --state-name andhra-pradesh
#
# Installation:
# python3 -m pip install requests pandas
#


import os
import requests
from datetime import datetime
import zipfile
import pandas as pd
import sys
import argparse

# Default configuration
DEFAULT_STATE_CODE = 32  # Kerala
DEFAULT_STATE_NAME = 'kerala'

def get_state_config():
    """
    Get state configuration from command line arguments or use defaults
    """
    parser = argparse.ArgumentParser(description='Filter LGD data by state')
    parser.add_argument('--state-code', type=int, default=DEFAULT_STATE_CODE,
                        help=f'State code to filter (default: {DEFAULT_STATE_CODE})')
    parser.add_argument('--state-name', type=str, default=DEFAULT_STATE_NAME,
                        help=f'State name for output files (default: {DEFAULT_STATE_NAME})')
    
    args = parser.parse_args()
    return args.state_code, args.state_name.lower()

def get_valid_url(base_date):
    """
    Try to find a valid URL starting from the given date and going backwards
    
    :param base_date: datetime object to start from
    :return: tuple of (valid_url, date_string) or (None, None)
    """
    for i in range(7):  # Try up to 7 days back
        current_date = base_date.strftime('%d%b%Y')
        current_date = current_date[:2] + current_date[2:5].capitalize() + current_date[5:]
        url = f'https://storage.googleapis.com/lgd_data_archive/{current_date}.zip'
        
        try:
            response = requests.head(url)
            if response.status_code == 200:
                return url, current_date
        except requests.RequestException:
            pass
            
        base_date = base_date - pd.Timedelta(days=1)
    
    return None, None

def download_and_process_data(state_code, state_name):
    """
    Download ZIP file based on today's date or previous available date
    
    :param state_code: State code to filter
    :param state_name: State name for output files
    :return: List of filtered DataFrames
    """
    # Create necessary directories
    download_dir = 'downloads'
    extracted_dir = 'extracted'
    filtered_dir = 'filtered'
    
    os.makedirs(download_dir, exist_ok=True)
    os.makedirs(extracted_dir, exist_ok=True)
    os.makedirs(filtered_dir, exist_ok=True)
    
    # Try to find a valid URL starting from today
    url, date_string = get_valid_url(datetime.now())
    
    if not url:
        print("No valid data file found in the last 7 days")
        # Check if we have existing downloaded data to use
        existing_files = [f for f in os.listdir(download_dir) if f.endswith('.zip')]
        if existing_files:
            # Use the most recent existing file
            existing_files.sort(reverse=True)
            date_string = existing_files[0].replace('.zip', '')
            zip_path = os.path.join(download_dir, f'{date_string}.zip')
            print(f"Using existing data file: {date_string}.zip")
        else:
            print("No existing data files found")
            return []
    else:
        # Check if file already exists
        zip_path = os.path.join(download_dir, f'{date_string}.zip')
        if os.path.exists(zip_path):
            print(f"File {date_string}.zip already exists, skipping download")
        else:
            # Download only if file doesn't exist
            try:
                print(f"Downloading file from {url}")
                response = requests.get(url)
                response.raise_for_status()
                
                # Save the ZIP file
                with open(zip_path, 'wb') as f:
                    f.write(response.content)
            except requests.RequestException as e:
                print(f"Download error: {e}")
                return []
    
    print(f"Found valid data file for date: {date_string}")
    
    # Continue with existing unzip and processing logic
    try:
        # Unzip the file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extracted_dir)
        
        # Find and filter CSV files, including in subdirectories
        filtered_dataframes = []
        
        # Add debug information about extracted files
        def process_directory(directory):
            print(f"\nProcessing directory: {directory}")
            for root, dirs, files in os.walk(directory):
                print(f"Files found in {root}: {files}")
                
                for filename in files:
                    if filename.endswith('.csv'):
                        file_path = os.path.join(root, filename)
                        print(f"\nProcessing file: {filename}")
                        
                        try:
                            # Read CSV without type conversion first
                            df = pd.read_csv(file_path)
                            print(f"Columns in file: {df.columns.tolist()}")
                            
                            # Check if 'State Code' column exists (case-insensitive)
                            state_code_col = next((col for col in df.columns if col.lower() == 'state code'), None)
                            
                            if state_code_col:
                                print(f"Found State Code column: {state_code_col}")
                                # Convert state code to integer, keeping NaN as is
                                df[state_code_col] = pd.to_numeric(df[state_code_col], errors='coerce').astype('Int64')
                                
                                # Convert numeric columns ending with 'Code' to integer if they contain numbers
                                for col in df.columns:
                                    if col.lower().endswith('code') and col != state_code_col:
                                        df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
                                
                                print(f"Unique state codes in file: {df[state_code_col].unique()}")
                                
                                filtered_df = df[df[state_code_col] == state_code]  # No need for float conversion
                                print(f"Rows found for state code {state_code}: {len(filtered_df)}")
                                
                                if not filtered_df.empty:
                                    output_path = os.path.join(filtered_dir, f'{state_name}_{filename}')
                                    filtered_df.to_csv(output_path, index=False)
                                    filtered_dataframes.append(filtered_df)
                                    print(f"Filtered data saved to {output_path}")
                                else:
                                    print(f"No data found for state code {state_code} in {filename}")
                            else:
                                print(f"'State Code' column not found. Available columns: {df.columns.tolist()}")
                        except Exception as e:
                            print(f"Error processing {filename}: {str(e)}")
        
        # Process the extracted directory and all its subdirectories
        process_directory(os.path.join(extracted_dir, date_string))
        
        return filtered_dataframes
    
    except requests.RequestException as e:
        print(f"Download error: {e}")
        return []
    except zipfile.BadZipFile:
        print("Error: Invalid ZIP file")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        return []

# Example usage
if __name__ == '__main__':
    # Get state configuration from command line or use defaults
    state_code, state_name = get_state_config()
    
    print(f"Processing data for {state_name.title()} (State Code: {state_code})")
    
    # Download and filter data for the specified state
    filtered_data = download_and_process_data(state_code, state_name)
    
    # Print basic info about filtered data
    for i, df in enumerate(filtered_data, 1):
        print(f"\nDataFrame {i}:")
        print(df.info())
        print("\nFirst few rows:")
        print(df.head())