/**
 * Copyright 2015 Jerome Hourioux
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Initially inspired from http://webaudioapi.com/samples/microphone
 * by Boris Smus, Apache 2 license
 * Some tricks coming from https://github.com/mattdiamond/Recorderjs
 * by Matt Diamond, MIT license
 */

/*jslint browser: true, devel: true, white: true */

"use strict";

function Resampler()
{
    // Public API
    this.downsample = function(input, in_sample_rate, out_sample_rate)
    {
        var in_period = 1 / in_sample_rate,
            out_period = 1 / out_sample_rate,
            tn=0, tnm1=-in_period,
            t=this.dt, j=0,
            input_nm1 = this.input_nm1,
            output = new Float32Array(
                Math.floor(input.length * (out_sample_rate / in_sample_rate))),
            i;

        for (i = 0; i < input.length; i += 1)
        {
            if (tnm1 <= t && t < tn)
            {
                // Linear interpolation
                output[j] = input_nm1 + (t - tnm1) * ((input[i] - input_nm1) / in_period);
                t += out_period;
                j += 1;
            }
            tn += in_period;
            tnm1 += in_period;
            input_nm1 = input[i];
        }

        // Save for next buffer
        this.dt = t - tn;
        this.input_nm1 = input[i-1];

        return output;
    };
    // Private members
    this.dt = 0;
    this.input_nm1 = 0;
}

function AudioIn()
{
    // Public API
    //this.start
    //this.stop
    // Compute the power value of a buffer
    //this.power
    // Rescale from Float32 to Int16
    // 1st argument: Float32Array
    this.toInt16LE = function (input) { return audioIn_toInt16(input, true); };
    this.toInt16BE = function (input) { return audioIn_toInt16(input, false); };

    // Callbacks
    // Pass an audio buffer
    // 1st argument: channel #
    // 2nd argument: Float32Array
    this.onAudio = null;
    this.onStopped = null;
    this.onError = null;
    // Public members
    this.errMsg = null;
    // Requested / actual sample rate
    this.sampleRate = null;
    // Buffer size
    this.bufferSize = 2048;

    // Private members
    this.context = null;
    this.rsmp = null;

    this.mediaStream = null;
    this.source = null;
    this.processor = null;
}

/***
 * Helper
 */
AudioIn.prototype.callback = function (c, args)
{
    if (c != null)
    {
        c.apply(this, args);
    }
};

AudioIn.prototype.init = function ()
{
    if (this.context == null)
    {
        // Start off by initializing a new context.
        this.context = new
                (  window.AudioContext
                || window.webkitAudioContext
                || window.mozAudioContext
                || window.msAudioContext)();
        // Prepare browser dependent stuff
        this.context.createScriptProcessor = 
                (  this.context.createScriptProcessor
                || this.context.createJavaScriptNode);
        navigator.getUserMedia =
                (  navigator.getUserMedia
                || navigator.webkitGetUserMedia
                || navigator.mozGetUserMedia
                || navigator.msGetUserMedia);

        this.rsmp = new Resampler();
    }
    // else: already inited
};

AudioIn.prototype.onAudioProcess = function (e)
{
    var i;

    // Set actual sample rate
    if (this.sampleRate == null)
    {
        this.sampleRate = e.inputBuffer.sampleRate;
    }
    // Check if need to resample
    if (this.sampleRate < e.inputBuffer.sampleRate)
    {
        // Need to downsample
        for (i = 0; i < e.inputBuffer.numberOfChannels; i += 1)
        {
            this.callback(this.onAudio,
                    [i, this.rsmp.downsample 
                                ( e.inputBuffer.getChannelData(i)
                                , e.inputBuffer.sampleRate
                                , this.sampleRate)]);
        }
    }
    else if (this.sampleRate > e.inputBuffer.sampleRate)
    {
        // Upsampling not supported
        this.callback(this.onError, [ 'Cannot upsample: not implemented' ]);
    }
    else
    {
        // No need to resample
        for (i = 0; i < e.inputBuffer.numberOfChannels; i += 1)
        {
            this.callback(this.onAudio,
                    [ i, e.inputBuffer.getChannelData(i)]);
        }
    }
};

AudioIn.prototype.onStreamOk = function (stream)
{
    this.mediaStream = stream;

    // Following callbacks have no effect
    /*
    stream.onactive = function(e) {
        console.log('Stream active');
    };
    stream.oninactive = function(e) {
        console.log('Stream inactive');
    };
    */

    this.source = this.context.createMediaStreamSource(stream);

    // Chrome requires one output channel, not Firefox
    this.processor = this.context.createScriptProcessor(this.bufferSize, 1, 1);
    this.processor.onaudioprocess = AudioIn.prototype.onAudioProcess.bind(this);

    // Connect graph
    this.source.connect(this.processor);
    // From Recorder.js: this should not be necessary, but it is for Chrome
    this.processor.connect(this.context.destination);

    //console.log("Recording at " + this.context.sampleRate + "Hz");
};

AudioIn.prototype.onStreamError = function (e)
{
    this.errMsg('Cannot get microphone: ', e);
    this.callback(this.onError);
};

AudioIn.prototype.start = function (sample_rate)
{
    // Lazy init
    this.init();
    if (this.mediaStream != null)
    {
        console.log("Already started");
        return;
    }
    if (sample_rate != null)
    {
        this.sampleRate = sample_rate;
    }
    // Start audio acquisition
    // Annoyingly browsers ask again the user to allow audio input
    navigator.getUserMedia
            ( {audio: true}
            , AudioIn.prototype.onStreamOk.bind(this)
            , AudioIn.prototype.onStreamError.bind(this));
};

AudioIn.prototype.stop = function ()
{
    var tracks, i;
    // Lazy init
    this.init();
    if (this.mediaStream == null)
    {
        console.log("Already stopped");
        return;
    }
    // Both disconnect are necessary for Firefox
    this.source.disconnect();
    this.processor.disconnect();
    // Close tracks and media stream so that the browser indicates the user
    // we are not listening anymore.
    tracks = this.mediaStream.getTracks();
    for (i = 0; i < tracks.length; i += 1)
    {
        tracks[i].stop();
    }
    this.mediaStream.stop();

    this.mediaStream = null;
    this.source = null;
    this.processor = null;
};

// Convert 32 bits floats to 16 bits signed ints
function audioIn_toInt16(input, little_endian)
{
    var nbytes = Int16Array.BYTES_PER_ELEMENT,
        buffer = new ArrayBuffer(input.length * nbytes),
        output = new DataView(buffer),
        i, offset, s;

    for (i = 0, offset = 0; i < input.length; i += 1, offset += nbytes)
    {
        s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, little_endian);
    }

    return new Int16Array(buffer);
}

// Compute average power of a buffer of Floats
AudioIn.prototype.power = function (input)
{
    var power = 0, i;

    for (i = 0; i < input.length; i += 1)
    {
        power += input[i] * input[i];
    }

    return Math.sqrt(power) / input.length;
};

