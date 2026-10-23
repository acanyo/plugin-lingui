"""Shared animation presets. Documents contain bounded data, never executable styles."""

def register_motion(components, defs, obj, ref):
    timing = {
        'duration': {'type': 'integer', 'minimum': 0, 'maximum': 2000},
        'easing': {'enum': ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']},
    }
    defs['motionTiming'] = obj(timing, [])
    defs['appearanceMotion'] = obj({
        'preset': {'enum': ['fade', 'fade-up', 'fade-down', 'zoom']},
        'delay': {'type': 'integer', 'minimum': 0, 'maximum': 2000},
        **timing,
    }, ['preset'])
    feedback = obj({'preset': {'enum': ['lift', 'grow']}, **timing}, ['preset'])
    properties = {
        'enter': ref('appearanceMotion'), 'exit': ref('appearanceMotion'),
        'hover': feedback, 'focus': feedback,
        'press': obj({'preset': {'const': 'scale-down'}, **timing}, ['preset']),
    }
    defs['motion'] = obj(properties, [])
    defs['stateMotion'] = obj({**properties, 'transition': ref('motionTiming')}, [])
    for name, schema in components.items():
        stateful = name in ['LingUI.Collapse', 'LingUI.Accordion', 'Tabs', 'LingUI.Tabs']
        schema['properties']['motion'] = ref('stateMotion' if stateful else 'motion')
