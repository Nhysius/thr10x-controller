// ui.js
// Binds UI elements to MIDI actions

document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-btn');
    const statusEl = document.getElementById('connection-status');
    const mainContent = document.getElementById('controls');
    
    // Connection Logic
    connectBtn.addEventListener('click', async () => {
        connectBtn.innerText = "Conectando...";
        connectBtn.disabled = true;
        
        const success = await window.initMidi();
        
        if (success || window.outputPort) {
            statusEl.innerText = "Conectado al Amplificador";
            statusEl.className = "status connected";
            connectBtn.style.display = 'none'; // Hide connect button once connected
            mainContent.classList.remove('disabled'); // Enable controls
        } else {
            statusEl.innerText = "No se encontró el Amplificador. Revisa el USB OTG.";
            statusEl.className = "status disconnected";
            connectBtn.innerText = "Reintentar Conexión";
            connectBtn.disabled = false;
        }
    });

    // Amp Model Selector
    const modelBtns = document.querySelectorAll('.model-btn');
    modelBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // UI Update
            modelBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // MIDI Update
            const modelIndex = parseInt(e.target.getAttribute('data-model'));
            window.THR.setAmpType(modelIndex);
        });
    });

    // Knobs (Sliders)
    const attachSlider = (id, paramFn) => {
        const slider = document.getElementById(id);
        const display = document.getElementById(`${id}-val`);
        
        // Listen to Input (live dragging - might flood MIDI if too fast, but usually okay)
        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            display.innerText = val;
            paramFn(val);
        });
    };

    attachSlider('gain', window.THR.setGain);
    attachSlider('master', window.THR.setMaster);
    attachSlider('bass', window.THR.setBass);
    attachSlider('middle', window.THR.setMiddle);
    attachSlider('treble', window.THR.setTreble);

    // Effect Toggles & Specific Knobs
    const attachToggle = (id, paramFn, knobId = null) => {
        const toggle = document.getElementById(id);
        toggle.addEventListener('change', (e) => {
            paramFn(e.target.checked);
            if (knobId) {
                const knob = document.getElementById(knobId);
                knob.disabled = !e.target.checked;
            }
        });
    };

    attachToggle('chorus-toggle', window.THR.toggleChorus);
    attachToggle('flanger-toggle', window.THR.toggleFlanger);
    attachToggle('phaser-toggle', window.THR.togglePhaser);
    attachToggle('tremolo-toggle', window.THR.toggleTremolo);
    attachToggle('delay-toggle', window.THR.toggleDelay);
    attachToggle('reverb-toggle', window.THR.toggleReverb);
    
    // Gate and Compressor has value params
    attachToggle('gate-toggle', window.THR.toggleGate, 'gate-knob');
    attachToggle('comp-toggle', window.THR.toggleComp, 'comp-knob');

    // Attach Gate/Comp Knobs (assuming they are 0-100 mapping)
    const attachFxKnob = (id, paramFn) => {
        const knob = document.getElementById(id);
        knob.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            paramFn(val);
        });
    };
    attachFxKnob('gate-knob', window.THR.setGateVal);
    attachFxKnob('comp-knob', window.THR.setCompVal);

    // Cab Selector
    const cabSelector = document.getElementById('cab-selector');
    cabSelector.addEventListener('change', (e) => {
        window.THR.setCabType(parseInt(e.target.value));
    });
});
