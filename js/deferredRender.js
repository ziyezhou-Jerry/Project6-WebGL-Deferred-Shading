(function() {
    'use strict';
    // deferredSetup.js must be loaded first

    R.deferredRender = function(state) {
        if (!aborted && (
            !R.progCopy ||
            !R.progRed ||
            !R.progClear ||
            !R.prog_Ambient ||
            !R.prog_BlinnPhong_PointLight ||
            !R.prog_Debug ||
            !R.progPost1 || !R.progPost_bloom || !R.progPost_bloom2 || !R.progToon)) {
            console.log('waiting for programs to load...');
            return;
        }

        // Move the R.lights
        for (var i = 0; i < R.lights.length; i++) {
            // OPTIONAL TODO: Edit if you want to change how lights move
            var mn = R.light_min[1];
            var mx = R.light_max[1];
            R.lights[i].pos[1] = (R.lights[i].pos[1] + R.light_dt - mn + mx) % mx + mn;
        }

        // Execute deferred shading pipeline

        // CHECKITOUT: START HERE! You can even uncomment this:
        //debugger;

        //{ // TODO: this block should be removed after testing renderFullScreenQuad
        //    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //    // TODO: Implement/test renderFullScreenQuad first
        //    renderFullScreenQuad(R.progRed);
        //    return;
        //}

        R.pass_copy.render(state);

        if (cfg && cfg.debugView >= 0) {
            // Do a debug render instead of a regular render
            // Don't do any post-processing in debug mode
            R.pass_debug.render(state);
        } else {
            // * Deferred pass and postprocessing pass(es)
            // TODO: uncomment these
            R.pass_deferred.render(state);
            R.pass_post1.render(state);

            if (cfg.Bloom)
            {
                R.pass_post2.render(state); //bloom 1
                R.pass_post3.render(state); //bloom 2
            }
            else if (cfg.Toon)
            {
                R.pass_post4.render(state); //toon
            }
            

           

            // OPTIONAL TODO: call more postprocessing passes, if any
        }
    };
    //=====================================================
    /**
     * 'copy' pass: Render into g-buffers
     */
    R.pass_copy.render = function(state) {
        // * Bind the framebuffer R.pass_copy.fbo
        // TODO: ^
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_copy.fbo);

        // * Clear screen using R.progClear
        TODO: renderFullScreenQuad(R.progClear);
        // * Clear depth buffer to value 1.0 using gl.clearDepth and gl.clear
        // TODO: ^
        // TODO: ^
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);


        // * "Use" the program R.progCopy.prog
        // TODO: ^
        gl.useProgram(R.progCopy.prog);
        
        // TODO: Write glsl/copy.frag.glsl


        var m = state.cameraMat.elements;
        // * Upload the camera matrix m to the uniform R.progCopy.u_cameraMat
        //   using gl.uniformMatrix4fv
        // TODO: ^
        gl.uniformMatrix4fv(R.progCopy.u_cameraMat,false,m);

        // * Draw the scene
        drawScene(state);
    };

    var drawScene = function(state) {
        for (var i = 0; i < state.models.length; i++) {
            var m = state.models[i];

            // If you want to render one model many times, note:
            // readyModelForDraw only needs to be called once.
            readyModelForDraw(R.progCopy, m);

            drawReadyModel(m);
        }
    };

    R.pass_debug.render = function(state) {
        // * Unbind any framebuffer, so we can write to the screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Bind/setup the debug "lighting" pass
        // * Tell shader which debug view to use
        bindTexturesForLightPass(R.prog_Debug);
        gl.uniform1i(R.prog_Debug.u_debug, cfg.debugView);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.prog_Debug);
    };

    /**
     * 'deferred' pass: Add lighting results for each individual light
     */
    R.pass_deferred.render = function(state) {
        // * Bind R.pass_deferred.fbo to write into for later postprocessing
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_deferred.fbo);
        //gl.bindFramebuffer(gl.FRAMEBUFFER, null); //without postprocessing comment out if postprocessing 

        // * Clear depth to 1.0 and color to black
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // * _ADD_ together the result of each lighting pass

        // Enable blending and use gl.blendFunc to blend with:
        //   color = 1 * src_color + 1 * dst_color
        // TODO: ^
        gl.enable(gl.BLEND);
        //gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);

        // * Bind/setup the ambient pass, and render using fullscreen quad
        bindTexturesForLightPass(R.prog_Ambient);
        renderFullScreenQuad(R.prog_Ambient);

        // * Bind/setup the Blinn-Phong pass, and render using fullscreen quad
        bindTexturesForLightPass(R.prog_BlinnPhong_PointLight);

        // TODO: add a loop here, over the values in R.lights, which sets the
        //   uniforms R.prog_BlinnPhong_PointLight.u_lightPos/Col/Rad etc.,
        //   then does renderFullScreenQuad(R.prog_BlinnPhong_PointLight).

        // TODO: In the lighting loop, use the scissor test optimization
        // Enable gl.SCISSOR_TEST, render all lights, then disable it.
        //
        // getScissorForLight returns null if the scissor is off the screen.
        // Otherwise, it returns an array [xmin, ymin, width, height].
        //
        //   var sc = getScissorForLight(state.viewMat, state.projMat, light);

        // Enables depth testing
        gl.enable(gl.SCISSOR_TEST);

        for (var i = 0; i < R.lights.length; i++)
        {
            
            var sc = getScissorForLight(state.viewMat, state.projMat, R.lights[i]);
            gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightPos, R.lights[i].pos);
            gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightCol, R.lights[i].col);
            gl.uniform1f(R.prog_BlinnPhong_PointLight.u_lightRad, R.LIGHT_RADIUS);

            var xmin  = 0;
            var xmax  = 0;
            var ymin  = 0;
            var ymax  = 0;


            if (sc != null)
            {
                gl.scissor(sc[0], sc[1], sc[2], sc[3]);
                xmin = sc[0]/width;
                xmax = (sc[0] + sc[2])/width;
                ymin = sc[1]/height;
                ymax = (sc[1] + sc[3])/height;
            }
            else
            { gl.scissor(0, 0, 0, 0); }

            if (!cfg.debugScissor)
                renderFullScreenQuad(R.prog_BlinnPhong_PointLight);
            else
            {
                gl.uniform1f(R.progScdebug.u_xmin, xmin);
                gl.uniform1f(R.progScdebug.u_xmax, xmax);
                gl.uniform1f(R.progScdebug.u_ymin, ymin);
                gl.uniform1f(R.progScdebug.u_ymax, ymax);

                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                renderFullScreenQuad(R.progScdebug);
            }
        }

        gl.disable(gl.SCISSOR_TEST);
        // Disable blending so that it doesn't affect other code
        gl.disable(gl.BLEND);
    };

    var bindTexturesForLightPass = function(prog) {
        gl.useProgram(prog.prog);

        // * Bind all of the g-buffers and depth buffer as texture uniform
        //   inputs to the shader
        for (var i = 0; i < R.NUM_GBUFFERS; i++) {
            gl.activeTexture(gl['TEXTURE' + i]);
            gl.bindTexture(gl.TEXTURE_2D, R.pass_copy.gbufs[i]);
            gl.uniform1i(prog.u_gbufs[i], i);
        }
        gl.activeTexture(gl['TEXTURE' + R.NUM_GBUFFERS]);
        gl.bindTexture(gl.TEXTURE_2D, R.pass_copy.depthTex);
        gl.uniform1i(prog.u_depth, R.NUM_GBUFFERS);
    };

    /**
     * 'post1' pass: Perform (first) pass of post-processing
     */
    R.pass_post1.render = function(state) {
        // * Unbind any existing framebuffer (if there are no more passes)
        if (cfg.Bloom || cfg.Toon)
        {
            gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_post1.fbo);
        } 
        else
        {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        // * Clear the framebuffer depth to 1.0
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * Bind the postprocessing shader program
        gl.useProgram(R.progPost1.prog);

        // * Bind the deferred pass's color output as a texture input
        // Set gl.TEXTURE0 as the gl.activeTexture unit
        // TODO: ^
        gl.activeTexture(gl.TEXTURE0);
        // Bind the TEXTURE_2D, R.pass_deferred.colorTex to the active texture unit
        // TODO: ^
        gl.bindTexture(gl.TEXTURE_2D, R.pass_deferred.colorTex);

        // Configure the R.progPost1.u_color uniform to point at texture unit 0
        gl.uniform1i(R.progPost1.u_color, 0);

        gl.uniform1f(R.progPost1.u_width, width);
        gl.uniform1f(R.progPost1.u_height, height);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.progPost1);
    };


    R.pass_post2.render = function (state) {
        // * Unbind any existing framebuffer (if there are no more passes)
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_post2.fbo);

        // * Clear the framebuffer depth to 1.0
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * Bind the postprocessing shader program
        gl.useProgram(R.progPost_bloom.prog);

        // * Bind the deferred pass's color output as a texture input
        // Set gl.TEXTURE0 as the gl.activeTexture unit
        // TODO: ^
        gl.activeTexture(gl.TEXTURE0);
        // Bind the TEXTURE_2D, R.pass_deferred.colorTex to the active texture unit
        // TODO: ^
        gl.bindTexture(gl.TEXTURE_2D, R.pass_post1.colorTex);

        // Configure the R.progPost_bloom.u_color uniform to point at texture unit 0
        gl.uniform1i(R.progPost_bloom.u_color, 0);

        gl.uniform1f(R.progPost_bloom.u_width, width);
        gl.uniform1f(R.progPost_bloom.u_height, height);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.progPost_bloom);
    };

    R.pass_post3.render = function (state) {
        // * Unbind any existing framebuffer (if there are no more passes)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Clear the framebuffer depth to 1.0
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * Bind the postprocessing shader program
        gl.useProgram(R.progPost_bloom2.prog);

        // * Bind the deferred pass's color output as a texture input
        // Set gl.TEXTURE0 as the gl.activeTexture unit
        // TODO: ^
        gl.activeTexture(gl.TEXTURE0);
        // Bind the TEXTURE_2D, R.pass_deferred.colorTex to the active texture unit
        // TODO: ^
        gl.bindTexture(gl.TEXTURE_2D, R.pass_post2.colorTex);

        // Configure the R.progPost_bloom.u_color uniform to point at texture unit 0
        gl.uniform1i(R.progPost_bloom2.u_color, 0);

        gl.uniform1f(R.progPost_bloom2.u_width, width);
        gl.uniform1f(R.progPost_bloom2.u_height, height);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.progPost_bloom2);
    };



    R.pass_post4.render = function (state) {
        // * Unbind any existing framebuffer (if there are no more passes)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Clear the framebuffer depth to 1.0
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * Bind the postprocessing shader program
        gl.useProgram(R.progToon.prog);

        // * Bind the deferred pass's color output as a texture input
        // Set gl.TEXTURE0 as the gl.activeTexture unit
        // TODO: ^
        gl.activeTexture(gl.TEXTURE0);
        // Bind the TEXTURE_2D, R.pass_deferred.colorTex to the active texture unit
        // TODO: ^
        gl.bindTexture(gl.TEXTURE_2D, R.pass_post1.colorTex);

        // Configure the R.progPost_bloom.u_color uniform to point at texture unit 0
        gl.uniform1i(R.progToon.u_color, 0);

    

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.progToon);
    };




    var renderFullScreenQuad = (function() {
        // The variables in this function are private to the implementation of
        // renderFullScreenQuad. They work like static local variables in C++.

        // Create an array of floats, where each set of 3 is a vertex position.
        // You can render in normalized device coordinates (NDC) so that the
        // vertex shader doesn't have to do any transformation; draw two
        // triangles which cover the screen over x = -1..1 and y = -1..1.
        // This array is set up to use gl.drawArrays with gl.TRIANGLE_STRIP.
        var positions = new Float32Array([
           -1.0, -1.0, 0.0,
             1.0, -1.0, 0.0,
            -1.0, 1.0, 0.0,
              -1.0, 1.0, 0.0,
			 1.0, -1.0, 0.0,
             1.0,  1.0, 0.0
        ]);

        var vbo = null;

        var init = function() {
            // Create a new buffer with gl.createBuffer, and save it as vbo.
            // TODO: ^
            // Bind the VBO as the gl.ARRAY_BUFFER
            // TODO: ^
            // Upload the positions array to the currently-bound array buffer
            // using gl.bufferData in static draw mode.
            // TODO: ^

            vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        };

        return function(prog) {
            if (!vbo) {
                // If the vbo hasn't been initialized, initialize it.
                init();
            }

            // Bind the program to use to draw the quad
            gl.useProgram(prog.prog);

            // Bind the VBO as the gl.ARRAY_BUFFER
            // TODO: ^
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            // Enable the bound buffer as the vertex attrib array for
            // prog.a_position, using gl.enableVertexAttribArray
            // TODO: ^
            gl.enableVertexAttribArray(prog.a_position);
     
            // Use gl.vertexAttribPointer to tell WebGL the type/layout for
            // prog.a_position's access pattern.
            // TODO: ^
            gl.vertexAttribPointer(prog.a_position, 3, gl.FLOAT, false, 0, 0);

            // Use gl.drawArrays (or gl.drawElements) to draw your quad.
            // TODO: ^
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Unbind the array buffer.
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        };
    })();
})();
