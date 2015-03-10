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

$( document ).ready(function() {

    au1 = new AudioIn();
    au2 = new AudioIn();
    var nb_buffers = 0;

    au1.onAudio = function (i, b)
    {
        $('#stat').html("Channel " + i + " got buffer " + nb_buffers++ + " of length " + b.length);
        $('#power').html("Power: " + au1.power(b));
    }

    au2.onAudio = function (i, b)
    {
        var p = au2.power(b);
        var buf = au2.toInt16LE(b);
        $('#stat').html("Channel " + i + " got buffer " + nb_buffers++ + " of length " + buf.length);
        $('#power').html("Power: " + p);
    }

    $("#start" ).click(function() {
        au1.start();
    });

    $("#stop" ).click(function() {
        au1.stop();
    });

    $("#start2" ).click(function() {
        au2.start(16000);
    });

    $("#stop2" ).click(function() {
        au2.stop();
    });
});

