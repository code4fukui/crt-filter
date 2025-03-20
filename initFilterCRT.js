/*
<!-- 8< -- ## GL SHADER STUFF STARTS HERE ## -- -->

<!-- Based on PICO-8 CRT framework by ultrabrite (twitter: @SpaceTrucker2k0) -->
<!-- https://www.lexaloffle.com/bbs/?tid=33488 -->

<!-- Updated with CRT shader by Mattias Gustavsson (twitter: @Mattias_G) -->
<!-- https://github.com/mattiasgustavsson/crtview -->
*/

import { shaders } from "./shaders.js";

export function initFilterCRT(pico8_canvas) {
	pico8_canvas.style.position = "absolute";
	pico8_canvas.style.top = 0;
	pico8_canvas.style.left = 0;

	var canvas = document.createElement('canvas');
	canvas.id = "crtcanvas";
	canvas.className = "canvas";
	//canvas.style.position = "absolute";
	//canvas.style.top = 0;
	//canvas.style.left = 0;
	canvas.width = pico8_canvas.clientWidth;
	canvas.height = pico8_canvas.clientHeight;
	var gl = canvas.getContext('webgl');
	if (!gl)
		return;

	var pico8_ctx = pico8_canvas.getContext('2d');

	pico8_canvas.parentNode.insertBefore(canvas, pico8_canvas);
	/* keep pico8_canvas in DOM for event handling, but hide it via opacity */
	pico8_canvas.style.opacity = 0;

	function unbind() {
		for (var i = 0; i < arguments.length; ++i) {
			var arg = arguments[i];
			switch (arg) {
				case gl.FRAMEBUFFER:
					gl.bindFramebuffer(arg, null);
					break;
				case gl.TEXTURE_2D:
					gl.bindTexture(arg, null);
					break;
				case gl.ARRAY_BUFFER:
					gl.bindBuffer(arg, null);
					break;
				default:
					gl.activeTexture(arg);
					gl.bindTexture(gl.TEXTURE_2D, null);
			}
		}
	}

	function compileShader(source, type) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			var info = gl.getShaderInfoLog(shader);
			throw ("could not compile shader:" + info);
		}
		return shader;
	};

	var vs = compileShader(shaders["common-vertex-shader"], gl.VERTEX_SHADER);
	var fs_crt = compileShader(shaders["crt-fragment-shader"], gl.FRAGMENT_SHADER);
	var fs_blur = compileShader(shaders["blur-fragment-shader"], gl.FRAGMENT_SHADER);
	var fs_accumulate = compileShader(shaders["accumulate-fragment-shader"], gl.FRAGMENT_SHADER);
	var fs_blend = compileShader(shaders["blend-fragment-shader"], gl.FRAGMENT_SHADER);
	var fs_copy = compileShader(shaders["copy-fragment-shader"], gl.FRAGMENT_SHADER);

	function createProgram(vs, fs, name) {
		var program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			var info = gl.getProgramInfoLog(program);
			throw ("shader " + name + " failed to link:" + info);
		}
		return program;
	}

	var crt_program = createProgram(vs, fs_crt, "crt_program");
	const loc_crt_pos = gl.getAttribLocation(crt_program, "pos");
	const loc_crt_time = gl.getUniformLocation(crt_program, "time");
	const loc_crt_backbuffer = gl.getUniformLocation(crt_program, "backbuffer");
	const loc_crt_blurbuffer = gl.getUniformLocation(crt_program, "blurbuffer");
	const loc_crt_resolution = gl.getUniformLocation(crt_program, "resolution");

	var blur_program = createProgram(vs, fs_blur, "blur_program");
	const loc_blur_pos = gl.getAttribLocation(blur_program, "pos");
	const loc_blur_blur = gl.getUniformLocation(blur_program, "blur");
	const loc_blur_texture = gl.getUniformLocation(blur_program, "texture");

	var accumulate_program = createProgram(vs, fs_accumulate, "accumulate_program");
	const loc_accumulate_pos = gl.getAttribLocation(accumulate_program, "pos");
	const loc_accumulate_tex0 = gl.getUniformLocation(accumulate_program, "tex0");
	const loc_accumulate_tex1 = gl.getUniformLocation(accumulate_program, "tex1");
	const loc_accumulate_modulate = gl.getUniformLocation(accumulate_program, "modulate");

	var blend_program = createProgram(vs, fs_blend, "blend_program");
	const loc_blend_pos = gl.getAttribLocation(blend_program, "pos");
	const loc_blend_tex0 = gl.getUniformLocation(blend_program, "tex0");
	const loc_blend_tex1 = gl.getUniformLocation(blend_program, "tex1");
	const loc_blend_modulate = gl.getUniformLocation(blend_program, "modulate");

	var copy_program = createProgram(vs, fs_copy, "copy_program");
	const loc_copy_pos = gl.getAttribLocation(copy_program, "pos");
	const loc_copy_tex0 = gl.getUniformLocation(copy_program, "tex0");

	var posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
		[-1, -1, 0, 0,
			1, -1, 1, 0,
			1,  1, 1, 1,
			-1,  1, 0, 1]), gl.STATIC_DRAW);
	unbind(gl.ARRAY_BUFFER);

	function bindVertexBuffer(loc_pos) {
		gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
		gl.vertexAttribPointer(loc_pos, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(loc_pos);
	}

	var tex_backbuffer = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex_backbuffer);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	unbind(gl.TEXTURE_2D)

	var texfbos = [];
	for (var i = 0; i < 4; ++i) {
		var tex = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D,  tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		unbind(gl.TEXTURE_2D)
		var fbo = gl.createFramebuffer();
		texfbos.push({tex: tex, fbo: fbo});
	}
	const blur_buf = texfbos[0];
	const blur_tmp = texfbos[1];
	const accum_buf = texfbos[2];
	const accum_cpy = texfbos[3];

	function drawBlurAxis(srctex, dstbuf, blurx, blury) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, dstbuf);
		gl.useProgram(blur_program);
		bindVertexBuffer(loc_blur_pos);
		gl.uniform2f(loc_blur_blur, blurx, blury);
		gl.uniform1i(loc_blur_texture, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, srctex);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		unbind(gl.TEXTURE_2D, gl.ARRAY_BUFFER, gl.FRAMEBUFFER);
	}

	function drawBlur(srctex, dstbuf, tmp, r, w, h) {
		drawBlurAxis(srctex, tmp.fbo, r/w, 0);
		drawBlurAxis(tmp.tex, dstbuf, 0, r/h);
	}

	function drawCopy(srctex, dstbuf) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, dstbuf);
		gl.useProgram(copy_program);
		bindVertexBuffer(loc_copy_pos);
		gl.uniform1i(loc_copy_tex0, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, srctex);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		unbind(gl.TEXTURE_2D, gl.ARRAY_BUFFER, gl.FRAMEBUFFER);
	}

	var lastdw = -1;
	var lastdh = -1;

	function draw(now) {
		var time = now * 0.001;

		/* hack fix for Safari: texImage2D fails to copy pico8_canvas to tex_backbuffer */
		pico8_ctx.resetTransform();
		pico8_ctx.clearRect(-1, -1, 1, 1);

		var p8scale = Math.ceil(Math.max(
			pico8_canvas.clientWidth / pico8_canvas.width,
			pico8_canvas.clientHeight / pico8_canvas.height));
		p8scale = Math.max(1, Math.min(4, p8scale));

		var dw = pico8_canvas.width * p8scale;
		var dh = pico8_canvas.height * p8scale;

		if (lastdw != dw || lastdh != dh) {
			for (var i = 0; i < texfbos.length; ++i) {
				var texture = texfbos[i].tex;
				var framebuffer = texfbos[i].fbo;
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, dw, dh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
				unbind(gl.TEXTURE_2D, gl.FRAMEBUFFER);
			}
		}

		/* blit pico8 screen to backbuffer; backbuffer = texImage2D(pico8_canvas) */
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex_backbuffer);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pico8_canvas);
		unbind(gl.TEXTURE_2D);

		gl.viewport(0, 0, dw, dh);

		/* blur previous accumulation buffer; blur_buf = blur(accum_cpy) */
		drawBlur(accum_cpy.tex, blur_buf.fbo, blur_tmp, 1.0, dw, dh);

		/* update accumulation buffer; accum_buf = accumulate(backbuffer, blur_buf) */
		gl.bindFramebuffer(gl.FRAMEBUFFER, accum_buf.fbo);
		gl.useProgram(accumulate_program);
		bindVertexBuffer(loc_accumulate_pos);
		gl.uniform1i(loc_accumulate_tex0, 0);
		gl.uniform1i(loc_accumulate_tex1, 1);
		gl.uniform1f(loc_accumulate_modulate, 1.0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex_backbuffer);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, blur_buf.tex);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		unbind(gl.TEXTURE0, gl.TEXTURE1, gl.ARRAY_BUFFER, gl.FRAMEBUFFER);

		/* store copy of accumulation buffer; accum_cpy = copy(accum_buf) */
		drawCopy(accum_buf.tex, accum_cpy.fbo);

		/* blend accumulation and backbuffer; accum_buf = blend(backbuffer, accum_cpy) */
		gl.bindFramebuffer(gl.FRAMEBUFFER, accum_buf.fbo);
		gl.useProgram(blend_program);
		bindVertexBuffer(loc_blend_pos);
		gl.uniform1i(loc_blend_tex0, 0);
		gl.uniform1i(loc_blend_tex1, 1);
		gl.uniform1f(loc_blend_modulate, 1.0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex_backbuffer);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, accum_cpy.tex);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		unbind(gl.TEXTURE0, gl.TEXTURE1, gl.ARRAY_BUFFER, gl.FRAMEBUFFER);

		/* add slight blur to backbuffer; accum_buf = blur(accum_buf) */
		drawBlur(accum_buf.tex, accum_buf.fbo, blur_tmp, 0.17, dw, dh);

		/* create fully blurred version of backbuffer; blur_buf = blur(accum_buf) */
		drawBlur(accum_buf.tex, blur_buf.fbo, blur_tmp, 1.0, dw, dh);

		/* ensure crt canvas overlays pico8_canvas */
		canvas.style.top = pico8_canvas.offsetTop;
		canvas.style.left = pico8_canvas.offsetLeft;
		var cw = canvas.width = pico8_canvas.clientWidth;
		var ch = canvas.height = pico8_canvas.clientHeight;
		gl.viewport(0, 0, cw, ch);

		/* apply crt shader; canvas = crt(accum_buf, blur_buf) */
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.useProgram(crt_program);
		bindVertexBuffer(loc_crt_pos);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, accum_buf.tex);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, blur_buf.tex);
		gl.uniform2f(loc_crt_resolution, cw, ch);
		gl.uniform1f(loc_crt_time, 1.5 * time);
		gl.uniform1i(loc_crt_backbuffer, 0);
		gl.uniform1i(loc_crt_blurbuffer, 1);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		unbind(gl.TEXTURE0, gl.TEXTURE1, gl.ARRAY_BUFFER, gl.FRAMEBUFFER);

		lastdw = dw;
		lastdh = dh;

		requestAnimationFrame(draw);
	}

	requestAnimationFrame(draw);
}
