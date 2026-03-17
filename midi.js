// midi.js
// Handles Web MIDI API connection and SysEx message construction

const YAMAHA_MANUFACTURER_ID = [0x43];
const THR10_MODEL_ID = [0x7D, 0x10, 0x41]; // Device ID for THR series

let midiAccess = null;
let outputPort = null;
let inputPort = null;

// The basic structure of a parameter change message for Yamaha THR
// F0 43 7D 10 41 30 01 [Param Group] [Param ID] [Value High] [Value Low] F7
// Based on community reverse engineering of the THR editor

const PARAM_GROUPS = {
    AMP: 0x00,
    CAB: 0x01,
    COMPRESSOR: 0x02,
    EFFECT: 0x03,    // Chorus, Flanger, Tremolo, Phaser
    DELAY: 0x04,
    REVERB: 0x05,
    GATE: 0x06
};

// Parameter IDs for AMP group (Group 0x00)
const AMP_PARAMS = {
    TYPE: 0x00, // 0-7
    GAIN: 0x01, // 0-100
    MASTER: 0x02, // 0-100
    BASS: 0x03, // 0-100
    MIDDLE: 0x04, // 0-100
    TREBLE: 0x05 // 0-100
};

// Parameter IDs for CAB group (Group 0x01)
const CAB_PARAMS = {
    TYPE: 0x00 // 0=Bypass, 1=Brit4x12, 2=US2x12, 3=US4x12, 4=Yamaha4x12, etc
};

// Toggle IDs for Effects (simplified to On/Off mapping for this basic version)
const FX_TOGGLES = {
    COMPRESSOR: { group: PARAM_GROUPS.COMPRESSOR, param: 0x00, valueParam: 0x01 }, // 0x00 is type/bypass, usually 0x01 is the main param (Sustain/Level)
    CHORUS: { group: PARAM_GROUPS.EFFECT, param: 0x00, typeVal: 1 }, 
    FLANGER: { group: PARAM_GROUPS.EFFECT, param: 0x00, typeVal: 2 }, 
    PHASER: { group: PARAM_GROUPS.EFFECT, param: 0x00, typeVal: 3 }, 
    TREMOLO: { group: PARAM_GROUPS.EFFECT, param: 0x00, typeVal: 4 }, 
    DELAY: { group: PARAM_GROUPS.DELAY, param: 0x00 },
    REVERB: { group: PARAM_GROUPS.REVERB, param: 0x00 },
    GATE: { group: PARAM_GROUPS.GATE, param: 0x00, valueParam: 0x01 } // 0x00 is bypass, 0x01 is threshold/level
};

async function initMidi() {
    try {
        console.log("Requesting MIDI access with SysEx permissions...");
        midiAccess = await navigator.requestMIDIAccess({ sysex: true });
        console.log("MIDI Access Granted.");
        
        midiAccess.onstatechange = (event) => {
            console.log(`MIDI State Change: ${event.port.name} ${event.port.state}`);
            scanPorts(); // Refresh if something unplugs
        };
        
        return scanPorts();
    } catch (err) {
        console.error("Failed to get MIDI access", err);
        return false;
    }
}

function scanPorts() {
    if (!midiAccess) return false;
    
    outputPort = null;
    inputPort = null;
    
    const inputs = Array.from(midiAccess.inputs.values());
    const outputs = Array.from(midiAccess.outputs.values());
    
    let debugInfo = `Available Outputs (${outputs.length}): `;
    
    // Look for Yamaha THR explicitly first
    for (let output of outputs) {
        debugInfo += `[${output.name}] `;
        if (output.name.toLowerCase().includes('thr') || output.name.toLowerCase().includes('yamaha')) {
            outputPort = output;
            console.log("Found Output Port explicitly:", output.name);
            break; // Found preferred
        }
    }
    
    // Fallback: Just grab the first available output port (very common with OTG generic adapters)
    if (!outputPort && outputs.length > 0) {
        outputPort = outputs[0];
        console.log("Using first available output port as fallback:", outputPort.name);
    }
    
    for (let input of inputs) {
         if (input.name === (outputPort ? outputPort.name : input.name)) {
             inputPort = input;
             inputPort.onmidimessage = handleIncomingMidi;
             break;
         }
    }
    
    window.lastMidiDebugInfo = debugInfo;
    
    if(outputPort) {
        window.outputPort = outputPort; // Ensure it is globally set for ui.js to check
        return true;
    }
    return false;
}

function handleIncomingMidi(message) {
    // Advanced: Handle two-way sync (knobs turned on amp update UI)
    // For MVP, we will just send one-way commands.
    console.log("Received MIDI:", message.data);
}

// Sends a parameter change SysEx to the THR
function sendParamChange(group, paramId, value) {
    if (!outputPort) {
        console.warn("Cannot send MIDI, no output port connected.");
        return;
    }
    
    // THR SysEx format requires value split if it exceeds 127, but most basic params are 0-100
    // We send [Group] [Param ID] [Value High Byte] [Value Low Byte]
    // For 0-100, High Byte is 0, Low Byte is value.
    
    const highByte = (value >> 7) & 0x7F;
    const lowByte = value & 0x7F;
    
    const sysExMessage = [
        0xF0, // SysEx Start
        YAMAHA_MANUFACTURER_ID[0], // 0x43
        THR10_MODEL_ID[0], // 0x7D
        THR10_MODEL_ID[1], // 0x10
        THR10_MODEL_ID[2], // 0x41
        0x30, // Address High (Parameter Change)
        0x01, // Address Mid
        group, // Block (Param Group)
        paramId, // Parameter ID
        highByte, // Value MSB
        lowByte, // Value LSB
        0xF7 // SysEx End
    ];
    
    console.log("Sending SysEx:", sysExMessage.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
    outputPort.send(sysExMessage);
}

// Helper functions for specific controls
const THR = {
    setAmpType: (typeIndex) => sendParamChange(PARAM_GROUPS.AMP, AMP_PARAMS.TYPE, typeIndex),
    setGain: (val) => sendParamChange(PARAM_GROUPS.AMP, AMP_PARAMS.GAIN, val),
    setMaster: (val) => sendParamChange(PARAM_GROUPS.AMP, AMP_PARAMS.MASTER, val),
    setBass: (val) => sendParamChange(PARAM_GROUPS.AMP, AMP_PARAMS.BASS, val),
    setMiddle: (val) => sendParamChange(PARAM_GROUPS.AMP, AMP_PARAMS.MIDDLE, val),
    setTreble: (val) => sendParamChange(PARAM_GROUPS.AMP, AMP_PARAMS.TREBLE, val),
    
    // Effect toggles: 0 is bypass, other numbers define the effect type.
    // Modulation effects (Chorus, Flanger, Phaser, Tremolo) typically share the same block (0x03) and param (0x00) for type.
    toggleChorus: (isOn) => sendParamChange(FX_TOGGLES.CHORUS.group, FX_TOGGLES.CHORUS.param, isOn ? FX_TOGGLES.CHORUS.typeVal : 0),
    toggleFlanger: (isOn) => sendParamChange(FX_TOGGLES.FLANGER.group, FX_TOGGLES.FLANGER.param, isOn ? FX_TOGGLES.FLANGER.typeVal : 0),
    togglePhaser: (isOn) => sendParamChange(FX_TOGGLES.PHASER.group, FX_TOGGLES.PHASER.param, isOn ? FX_TOGGLES.PHASER.typeVal : 0),
    toggleTremolo: (isOn) => sendParamChange(FX_TOGGLES.TREMOLO.group, FX_TOGGLES.TREMOLO.param, isOn ? FX_TOGGLES.TREMOLO.typeVal : 0),
    toggleDelay: (isOn) => sendParamChange(FX_TOGGLES.DELAY.group, FX_TOGGLES.DELAY.param, isOn ? 1 : 0),
    toggleReverb: (isOn) => sendParamChange(FX_TOGGLES.REVERB.group, FX_TOGGLES.REVERB.param, isOn ? 1 : 0), // Reverb uses types (Spring, Hall, etc), index 1 is usually generic

    // Cab Sim
    setCabType: (typeIndex) => sendParamChange(PARAM_GROUPS.CAB, CAB_PARAMS.TYPE, typeIndex),

    // Compressor (Simplified: toggle turns it on to type 1 "Rack", setComp adjusts a main param like Sustain)
    toggleComp: (isOn) => sendParamChange(FX_TOGGLES.COMPRESSOR.group, FX_TOGGLES.COMPRESSOR.param, isOn ? 1 : 0),
    setCompVal: (val) => sendParamChange(FX_TOGGLES.COMPRESSOR.group, FX_TOGGLES.COMPRESSOR.valueParam, val),

    // Noise Gate (toggle on/off, setGate adjusts Threshold)
    toggleGate: (isOn) => sendParamChange(FX_TOGGLES.GATE.group, FX_TOGGLES.GATE.param, isOn ? 1 : 0),
    setGateVal: (val) => sendParamChange(FX_TOGGLES.GATE.group, FX_TOGGLES.GATE.valueParam, val)
};

// Export to window so ui.js can access it
window.THR = THR;
window.initMidi = initMidi;
window.scanPorts = scanPorts;
window.outputPort = null; // UI check
