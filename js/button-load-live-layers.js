/**
 * Button : Load Live Layers
 */

export class ButtonLoadLiveLayers {

    onAdd(map) {
        this._container = $('<div>', {
            class: 'mapboxgl-ctrl mapboxgl-ctrl-group load-live-layers'
        })[0];

        $('<button>', {
            class: 'mapboxgl-ctrl-icon',
            type: 'button',
            'aria-label': 'Load Live Layers',
            css: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px'
            }
        })
            .append($('<sl-icon>', {
                name: 'radioactive',
            }))
            .on('click', () => {
                location.href = '/?p=live';
            })
            .on('mouseenter', function () {
                $(this).css('backgroundColor', '#f0f0f0');
            })
            .on('mouseleave', function () {
                $(this).css('backgroundColor', '#ffffff');
            })
            .appendTo(this._container);

        return this._container;
    }

    onRemove() {
        $(this._container).remove();
    }
} 