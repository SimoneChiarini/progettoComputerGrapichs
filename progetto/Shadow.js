// Vertex shader program for generating a shadow map
var SHADOW_VSHADER_SOURCE =
  '#version 300 es\n' +
  'in vec4 a_Position;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' +
  '}\n';

// Fragment shader program for generating a shadow map
var SHADOW_FSHADER_SOURCE =
  '#version 300 es\n' +
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'out vec4 fragColor;\n' +
  'void main() {\n' +
  '  fragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 0.0);\n' + // Write the z-value in R
  '}\n';

// Vertex shader program for regular drawing
var VSHADER_SOURCE =
  '#version 300 es\n' +
  'in vec4 a_Position;\n' +
  'in vec4 a_Color;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_MvpMatrixFromLight;\n' +
  'out vec4 v_PositionFromLight;\n' +
  'out vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' + 
  '  v_PositionFromLight = u_MvpMatrixFromLight * a_Position;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program for regular drawing
var FSHADER_SOURCE =
  '#version 300 es\n' +
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'uniform sampler2D u_ShadowMap;\n' +
  'in vec4 v_PositionFromLight;\n' +
  'in vec4 v_Color;\n' +
  'out vec4 fragColor;\n' +
  'void main() {\n' +
  '  vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;\n' +
  '  vec4 rgbaDepth = texture(u_ShadowMap, shadowCoord.xy);\n' +
  '  float depth = rgbaDepth.r;\n' + // Retrieve the z-value from R
  '  float visibility = (shadowCoord.z > depth + 0.005) ? 0.7 : 1.0;\n' +
  '  fragColor = vec4(v_Color.rgb * visibility, v_Color.a);\n' +
  '}\n';

var OFFSCREEN_WIDTH = 2048, OFFSCREEN_HEIGHT = 2048;
var LIGHT_X = -0.5, LIGHT_Y = 20, LIGHT_Z = 2; // Position of the light source

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl2');

  // Get the rendering context for WebGL
  //var gl = getWebGLContext(canvas);
  var gl = canvas.getContext('webgl2');
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders for generating a shadow map
  var shadowProgram = createProgram(gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);
  shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, 'a_Position');
  shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');
  if (shadowProgram.a_Position < 0 || !shadowProgram.u_MvpMatrix) {
    console.log('Failed to get the storage location of attribute or uniform variable from shadowProgram'); 
    return;
  }

  // Initialize shaders for regular drawing
  var normalProgram = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
  normalProgram.a_Position = gl.getAttribLocation(normalProgram, 'a_Position');
  normalProgram.a_Color = gl.getAttribLocation(normalProgram, 'a_Color');
  normalProgram.u_MvpMatrix = gl.getUniformLocation(normalProgram, 'u_MvpMatrix');
  normalProgram.u_MvpMatrixFromLight = gl.getUniformLocation(normalProgram, 'u_MvpMatrixFromLight');
  normalProgram.u_ShadowMap = gl.getUniformLocation(normalProgram, 'u_ShadowMap');
  if (normalProgram.a_Position < 0 || normalProgram.a_Color < 0 || !normalProgram.u_MvpMatrix ||
      !normalProgram.u_MvpMatrixFromLight || !normalProgram.u_ShadowMap) {
    console.log('Failed to get the storage location of attribute or uniform variable from normalProgram'); 
    return;
  }

  // Set the vertex information
  var triangle = initVertexBuffersForTriangle(gl);
  var rect = initVertexBuffersForRect(gl);
  var plane = initVertexBuffersForPlane(gl);
    var plane_l = initVertexBuffersForPlane_l(gl);
    var plane_f = initVertexBuffersForPlane_f(gl);
    var plane_r = initVertexBuffersForPlane_r(gl);
    var cube = initVertexBuffersForCube(gl);
    if (!triangle || !plane || !rect || !plane_r || !plane_f || !plane_l) {
    console.log('Failed to set the vertex information');
    return;
  }

  // Initialize framebuffer object (FBO)  
  var fbo = initFramebufferObject(gl);
  if (!fbo) {
    console.log('Failed to initialize frame buffer object');
    return;
  }
  gl.activeTexture(gl.TEXTURE0); // Set a texture object to the texture unit
  gl.bindTexture(gl.TEXTURE_2D, fbo.texture);

  // Set the clear color and enable the depth test
  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);

  var viewProjMatrixFromLight = new Matrix4(); // Prepare a view projection matrix for generating a shadow map
  viewProjMatrixFromLight.setPerspective(70.0, OFFSCREEN_WIDTH/OFFSCREEN_HEIGHT, 1.0, 100.0);
  viewProjMatrixFromLight.lookAt(LIGHT_X, LIGHT_Y, LIGHT_Z, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

  var viewProjMatrix = new Matrix4();          // Prepare a view projection matrix for regular drawing
  viewProjMatrix.setPerspective(45, canvas.width/canvas.height, 1.0, 100.0);
  viewProjMatrix.lookAt(0.0, 7.0, 9.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

    var currentAngle = 0.0; // Current rotation angle (degrees)
    var cAngle = [0.0, 0.0];
  var mvpMatrixFromLight_t = new Matrix4(); // A model view projection matrix from light source (for triangle)
  var mvpMatrixFromLight_r = new Matrix4(); // A model view projection matrix from light source (for triangle)
  var mvpMatrixFromLight_p = new Matrix4(); // A model view projection matrix from light source (for plane)
    var mvpMatrixFromLight_pl = new Matrix4();
    var mvpMatrixFromLight_pf = new Matrix4();
    var mvpMatrixFromLight_pr = new Matrix4();
    var mvpMatrixFromLight_c = new Matrix4();

  var tick = function() {
      

      currentAngle = animate(currentAngle);
         
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);               // Change the drawing destination to FBO
    gl.viewport(0, 0, OFFSCREEN_HEIGHT, OFFSCREEN_HEIGHT); // Set view port for FBO
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // Clear FBO    

    gl.useProgram(shadowProgram); // Set shaders for generating a shadow map
    // Draw the triangle and the plane (for generating a shadow map)
    drawTriangle(gl, shadowProgram, triangle, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_t.set(g_mvpMatrix); // Used later
    drawRect(gl, shadowProgram, rect, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_r.set(g_mvpMatrix); 
    drawPlane(gl, shadowProgram, plane, viewProjMatrixFromLight);
    mvpMatrixFromLight_p.set(g_mvpMatrix); // Used later
    drawPlane_l(gl, shadowProgram, plane_l, viewProjMatrixFromLight);
      mvpMatrixFromLight_pl.set(g_mvpMatrix);
      drawPlane_f(gl, shadowProgram, plane_f, viewProjMatrixFromLight);
      mvpMatrixFromLight_pf.set(g_mvpMatrix);
      drawPlane_r(gl, shadowProgram, plane_r, viewProjMatrixFromLight);
      mvpMatrixFromLight_pr.set(g_mvpMatrix);
      drawCube(gl, shadowProgram, cube, viewProjMatrixFromLight);
      mvpMatrixFromLight_c.set(g_mvpMatrix);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);               // Change the drawing destination to color buffer
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);    // Clear color and depth buffer

    gl.useProgram(normalProgram); // Set the shader for regular drawing
    gl.uniform1i(normalProgram.u_ShadowMap, 0);  // Pass 0 because gl.TEXTURE0 is enabled
    // Draw the triangle and plane ( for regular drawing)
    gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
    drawTriangle(gl, normalProgram, triangle, currentAngle, viewProjMatrix);
    gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_r.elements);
    drawRect(gl, normalProgram, rect, currentAngle, viewProjMatrix);
    gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_p.elements);
    drawPlane(gl, normalProgram, plane, viewProjMatrix);
    gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_pl.elements);
      drawPlane_l(gl, normalProgram, plane_l, viewProjMatrix);
      gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_pl.elements);
      drawPlane_f(gl, normalProgram, plane_f, viewProjMatrix);
      gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_pl.elements);
      drawPlane_r(gl, normalProgram, plane_r, viewProjMatrix);
      gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_c.elements);
      drawCube(gl, normalProgram, cube,  viewProjMatrix);
      
    window.requestAnimationFrame(tick, canvas);
  };
  tick(); 
}

// Coordinate transformation matrix
var g_modelMatrix = new Matrix4();
var g_mvpMatrix = new Matrix4();
function drawTriangle(gl, program, triangle, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
  g_modelMatrix.setRotate(angle, 0, 1, 0);
  draw(gl, program, triangle, viewProjMatrix);
}

function drawRect(gl, program, rect, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
    g_modelMatrix.setRotate((angle*4+30)%360, 0, 1, 0);
    draw(gl, program, rect, viewProjMatrix);
}

function drawPlane(gl, program, plane, viewProjMatrix) {
  // Set rotate angle to model matrix and draw plane
    g_modelMatrix.setRotate(0, 0, 1, 1);
  draw(gl, program, plane, viewProjMatrix);
}

function drawPlane_l(gl, program, plane_l, viewProjMatrix) {
    // Set rotate angle to model matrix and draw plane
    g_modelMatrix.setRotate(0, 0, 1, 1);
    draw(gl, program, plane_l, viewProjMatrix);
}
function drawPlane_f(gl, program, plane_f, viewProjMatrix) {
    // Set rotate angle to model matrix and draw plane
    g_modelMatrix.setRotate(0, 0, 1, 1);
    draw(gl, program, plane_f, viewProjMatrix);
}
function drawPlane_r(gl, program, plane_r, viewProjMatrix) {
    // Set rotate angle to model matrix and draw plane
    g_modelMatrix.setRotate(0, 0, 1, 1);
    draw(gl, program, plane_r, viewProjMatrix);
}
function drawCube(gl, program, cube, viewProjMatrix) {
    // Set rotate angle to model matrix and draw plane
    
    g_modelMatrix.setRotate(0, 0, 1, 0);
    draw(gl, program, cube, viewProjMatrix);
}

function draw(gl, program, o, viewProjMatrix) {
  initAttributeVariable(gl, program.a_Position, o.vertexBuffer);
  if (program.a_Color != undefined) // If a_Color is defined to attribute
    initAttributeVariable(gl, program.a_Color, o.colorBuffer);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);

  // Calculate the model view project matrix and pass it to u_MvpMatrix
  g_mvpMatrix.set(viewProjMatrix);
  g_mvpMatrix.multiply(g_modelMatrix);
  gl.uniformMatrix4fv(program.u_MvpMatrix, false, g_mvpMatrix.elements);

  gl.drawElements(gl.TRIANGLES, o.numIndices, gl.UNSIGNED_BYTE, 0);
}
//sign the buffer objects and enable the assignment
function initAttributeVariable(gl, a_attribute, buffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
  gl.enableVertexAttribArray(a_attribute);
}

function initVertexBuffersForCube(gl) {
    // Create a cube
    //    v6----- v5
    //   /|      /|
    //  v1------v0|
    //  | |     | |
    //  | |v7---|-|v4
    //  |/      |/
    //  v2------v3

    var vertices = new Float32Array([   // Vertex coordinates
        3.0, 2.0, 1.0, 1.0, 2.0, 1.0, 1.0, 4.0, 1.0, 3.0, 4.0, 1.0,  // v0-v1-v2-v3 front
             3.0, 2.0, 1.0,   3.0,2.0, -1.0,   3.0,4.0,-1.0,   3.0, 4.0,1.0,  // v0-v3-v4-v5 right
             3.0, 4.0, 1.0,   1.0, 4.0, 1.0,  1.0, 4.0,-1.0,  3.0, 4.0, -1.0,  // v0-v5-v6-v1 up
           1.0, 2.0, 1.0,  1.0, 2.0,-1.0,  1.0,4.0,-1.0,  1.0,4.0, 1.0,  // v1-v6-v7-v2 left
           3.0,2.0,1.0,   1.0,2.0,1.0,   1.0,2.0,-1.0,  3.0,2.0, 1.0,  // v7-v4-v3-v2 down
        3.0, 2.0, -1.0, 1.0, 2.0, -1.0, 1.0, 4.0, -1.0, 3.0, 4.0, -1.0   // v4-v7-v6-v5 back
    ]);

    var colors = new Float32Array([     // Colors
        1, 1, 0.0, 1.0, 1, 0, 0.5, 0.5,0, 0.5, 0.5, 0.0,  // v0-v1-v2-v3 front(blue)
        1, 1, 0.0, 1.0, 1, 0, 0.5, 0.5, 0, 0.5, 0.5, 0.0,  // v0-v3-v4-v5 right(green)
        0.4, 0.4, 0.2, 0.4, 0.4, 0.2, 0.4, 0.4, 0.2, 0.4, 0.4, 0.2,  // v0-v5-v6-v1 up(red)
        1, 1, 0.0, 1.0, 1, 0, 0.5, 0.5, 0, 0.5, 0.5, 0.0, // v1-v6-v7-v2 left
            1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  // v7-v4-v3-v2 down
        0.4, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0, 1.0   // v4-v7-v6-v5 back
    ]);

    var indices = new Uint8Array([       // Indices of the vertices
        0, 1, 2, 0, 2, 3,    // front
             4, 5, 6,   4, 6, 7,    // right
             8, 9,10,   8,10,11,    // up
            12,13,14,  12,14,15,    // left
            16,17,18,  16,18,19,    // down
        //    20,21,22,  20,22,23     // back
        4, 5, 6, 4, 6, 7,    // back
    ]);

    var o = new Object(); // Utilize Object object to return multiple buffer objects together

    // Write vertex information to buffer object
    o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
    o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
    if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null;

    o.numIndices = indices.length;

    // Unbind the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}

function initVertexBuffersForPlane(gl) {
  // Create a plane
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3


  // Vertex coordinates
  var vertices = new Float32Array([
    4.0, -1.7, 4.5,  -4.0, -1.7, 4.5,  -4.0, -1.7, -2.5,   4.0, -1.7, -2.5    // v0-v1-v2-v3
  ]);

  // Colors
  var colors = new Float32Array([
    0.2,0.2, 1.0,    0.2, 0.2, 1.0,  0.2, 0.2, 1.0,   0.2, 0.2, 1.0
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([0, 1, 2,   0, 2, 3]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}


function initVertexBuffersForPlane_l(gl) {
    // Create a plane
    //  v1------v0
    //  |        | 
    //  |        |
    //  |        |
    //  v2------v3


    // Vertex coordinates
    var vertices = new Float32Array([
        4.0, -1.7, 4.5, 4.0, -1.7, -2.5, 3.0, 5.7, -2.5, 3.0, 5.7, 2.5    // v0-v1-v2-v3
    ]);

    // Colors
    var colors = new Float32Array([
        0.7, 0.0, 1.0, 0.7, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0
    ]);

    // Indices of the vertices
    var indices = new Uint8Array([0, 1, 2, 0, 2, 3]);

    var o = new Object(); // Utilize Object object to return multiple buffer objects together

    // Write vertex information to buffer object
    o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
    o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
    if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null;

    o.numIndices = indices.length;

    // Unbind the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}
function initVertexBuffersForPlane_r(gl) {
    // Create a plane
    //  v1------v0
    //  |        | 
    //  |        |
    //  |        |
    //  v2------v3


    // Vertex coordinates
    var vertices = new Float32Array([
        -4.0, -1.7, 4.5, -4.0, -1.7, -2.5, -3.0, 5.7, -2.5, -3.0, 5.7, 2.5    // v0-v1-v2-v3
    ]);

    // Colors
    var colors = new Float32Array([
        0.7, 0.0, 1.0, 0.7, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0
    ]);

    // Indices of the vertices
    var indices = new Uint8Array([0, 1, 2, 0, 2, 3]);

    var o = new Object(); // Utilize Object object to return multiple buffer objects together

    // Write vertex information to buffer object
    o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
    o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
    if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null;

    o.numIndices = indices.length;

    // Unbind the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}

function initVertexBuffersForPlane_f(gl) {
    // Create a plane
    //  v1------v0
    //  |        | 
    //  |        |
    //  |        |
    //  v2------v3


    // Vertex coordinates
    var vertices = new Float32Array([
        4.0, -1.7, -2.5, -4.0, -1.7, -2.5, -3.0, 5.7, -2.5, 3.0, 5.7, -2.5    // v0-v1-v2-v3
    ]);

    // Colors
    var colors = new Float32Array([
        0.7, 0.7, 1.0, 0.7, 0.7, 1.0, 0.9, 0.5, 0.0, 0.9, 0.5, 0.0
    ]);

    // Indices of the vertices
    var indices = new Uint8Array([0, 1, 2, 0, 2, 3]);

    var o = new Object(); // Utilize Object object to return multiple buffer objects together

    // Write vertex information to buffer object
    o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
    o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
    if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null;

    o.numIndices = indices.length;

    // Unbind the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}


function initVertexBuffersForRect(gl) {
  // Create a rect
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3

  // Vertex coordinates
  var vertices = new Float32Array([
    -1.5, 0.0, 0.5,  0.0, 0.0, 0.0,  -1.0, 1.0,1.0,   -1.5, 1.0, 1.5    // v0-v1-v2-v3
  ]);

  // Colors
  var colors = new Float32Array([
    0.6, 1.0, 0.0,    0.7, 0.9, 0.1,  0.6, 1.0, 0.0,   0.8, 0.95, 0.05
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([0, 1, 2,   0, 2, 3]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initVertexBuffersForTriangle(gl) {
  // Create a triangle
  //       v2
  //      / | 
  //     /  |
  //    /   |
  //  v0----v1

  // Vertex coordinates
  var vertices = new Float32Array([-1.8, 1.7, 0.0,  -0.2, 1.7, 0.0,  -1.0, 1.7, 1.8]);
  // Colors
  var colors = new Float32Array([1.0, 0.5, 0.0,  1.0, 0.5, 0.0,  1.0, 0.0, 0.0]);    
  // Indices of the vertices
  var indices = new Uint8Array([0, 1, 2]);

  var o = new Object();  // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initArrayBufferForLaterUse(gl, data, num, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return null;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  // Store the necessary information to assign the object to the attribute variable later
  buffer.num = num;
  buffer.type = type;

  return buffer;
}

function initElementArrayBufferForLaterUse(gl, data, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return null;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);

  buffer.type = type;

  return buffer;
}

function initEventHandlers(canvas, currentAngle) {
    var dragging = false;         // Dragging or not
    var lastX = -1, lastY = -1;   // Last position of the mouse

    canvas.onmousedown = function (ev) {   // Mouse is pressed
        var x = ev.clientX, y = ev.clientY;
        // Start dragging if a mouse is in <canvas>
        var rect = ev.target.getBoundingClientRect();
        if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
            lastX = x; lastY = y;
            dragging = true;
        }
    };

    canvas.onmouseup = function (ev) { dragging = false; }; // Mouse is released

    canvas.onmousemove = function (ev) { // Mouse is moved
        var x = ev.clientX, y = ev.clientY;
        if (dragging) {
            var factor = 100 / canvas.height; // The rotation ratio
            var dx = factor * (x - lastX);
            var dy = factor * (y - lastY);
            // Limit x-axis rotation angle to -90 to 90 degrees
            currentAngle[0] = Math.max(Math.min(currentAngle[0] + dy, 90.0), -90.0);
            currentAngle[1] = currentAngle[1] + dx;
        }
        lastX = x, lastY = y;
    };
}

function initFramebufferObject(gl) {
  var framebuffer, texture, depthBuffer;

  // Define the error handling function
  var error = function() {
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    if (texture) gl.deleteTexture(texture);
    if (depthBuffer) gl.deleteRenderbuffer(depthBuffer);
    return null;
  }

  // Create a framebuffer object (FBO)
  framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    console.log('Failed to create frame buffer object');
    return error();
  }

  // Create a texture object and set its size and parameters
  texture = gl.createTexture(); // Create a texture object
  if (!texture) {
    console.log('Failed to create texture object');
    return error();
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Create a renderbuffer object and Set its size and parameters
  depthBuffer = gl.createRenderbuffer(); // Create a renderbuffer object
  if (!depthBuffer) {
    console.log('Failed to create renderbuffer object');
    return error();
  }
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);

  // Attach the texture and the renderbuffer object to the FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

  // Check if FBO is configured correctly
  var e = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (gl.FRAMEBUFFER_COMPLETE !== e) {
    console.log('Frame buffer object is incomplete: ' + e.toString());
    return error();
  }

  framebuffer.texture = texture; // keep the required object

  // Unbind the buffer object
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  return framebuffer;
}

var ANGLE_STEP = 40;   // The increments of rotation angle (degrees)

var last = Date.now(); // Last time that this function was called
function animate(angle) {
  var now = Date.now();   // Calculate the elapsed time
  var elapsed = now - last;
  last = now;
  // Update the current rotation angle (adjusted by the elapsed time)
  var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
  return newAngle % 360;
}
