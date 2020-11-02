
var main=function() {
  var CANVAS=document.getElementById("your_canvas");
  CANVAS.width=window.innerWidth;
  CANVAS.height=window.innerHeight;

  /*========================= CAPTURE MOUSE EVENTS ========================= */

  var AMORTIZATION=0.95;
  var drag=false;
  var old_x, old_y;
  var dX=0, dY=0;

  var mouseDown=function(e) {
    drag=true;
    old_x=e.pageX, old_y=e.pageY;
    e.preventDefault();
    return false;
  };

  var mouseUp=function(e){
    drag=false;
  };

  var mouseMove=function(e) {
    if (!drag) return false;
    dX=(e.pageX-old_x)*Math.PI/CANVAS.width,
      dY=(e.pageY-old_y)*Math.PI/CANVAS.height;
    THETA+=dX;
    PHI+=dY;
    old_x=e.pageX, old_y=e.pageY;
    e.preventDefault();
  };

  var keyDown=function(e) {
     
    switch(e.keyCode){
      case 39: LIGHTDIR[0] += 0.05;LIGHTMATRIX=LIBS.lookAtDir(LIGHTDIR, [0,1,0], [0,0,0]); break;  // The right arrow key was pressed
      case 37: LIGHTDIR[0] -= 0.05;LIGHTMATRIX=LIBS.lookAtDir(LIGHTDIR, [0,1,0], [0,0,0]); break;  // The left arrow key was pressed
      case 38: LIGHTDIR[2] += 0.05;LIGHTMATRIX=LIBS.lookAtDir(LIGHTDIR, [0,1,0], [0,0,0]);  break;  // The up arrow key was pressed
      case 40: LIGHTDIR[2] -= 0.05;LIGHTMATRIX=LIBS.lookAtDir(LIGHTDIR, [0,1,0], [0,0,0]);  break;  // The down arrow key was pressed
      default: return; // Prevent the unnecessary drawing
    }
}


  document.addEventListener("keydown", keyDown, false);
  CANVAS.addEventListener("mousedown", mouseDown, false);
  CANVAS.addEventListener("mouseup", mouseUp, false);
  CANVAS.addEventListener("mouseout", mouseUp, false);
  CANVAS.addEventListener("mousemove", mouseMove, false);

  /*========================= GET WEBGL CONTEXT ========================= */
  var GL;
  try {
    GL = CANVAS.getContext("experimental-webgl", {antialias: true});
    var EXT = GL.getExtension("OES_element_index_uint") ||
      GL.getExtension("MOZ_OES_element_index_uint") ||
        GL.getExtension("WEBKIT_OES_element_index_uint");
  } catch (e) {
    alert("You are not webgl compatible :(") ;
    return false;
  }

  /*========================= SHADERS ========================= */
  /*jshint multistr: true */

  var shader_vertex_source_shadowMap="\n\
attribute vec3 position;\n\
uniform mat4 Pmatrix, Lmatrix;\n\
varying float vDepth;\n\
\n\
void main(void) {\n\
vec4 position = Pmatrix*Lmatrix*vec4(position, 1.);\n\
float zBuf=position.z/position.w; //Z-buffer between -1 and 1\n\
vDepth=0.5+zBuf*0.5; //between 0 and 1\n\
gl_Position=position;\n\
}";

  var shader_fragment_source_shadowMap="\n\
precision mediump float;\n\
varying float vDepth;\n\
\n\
void main(void) {\n\
gl_FragColor=vec4(vDepth, 0.,0.,1.);\n\
}";


  var shader_vertex_source="\n\
attribute vec3 position, normal;\n\
attribute vec2 uv;\n\
uniform mat4 Pmatrix, Vmatrix, Mmatrix, Lmatrix, PmatrixLight;\n\
varying vec2 vUV;\n\
varying vec3 vNormal, vLightPos;\n\
\n\
void main(void) {\n\
\n\
//Shadow mapping : \n\
vec4 lightPos = Lmatrix*vec4(position, 1.);\n\
lightPos=PmatrixLight*lightPos;\n\
vec3 lightPosDNC=lightPos.xyz/lightPos.w;\n\
vLightPos=vec3(0.5,0.5,0.5)+lightPosDNC*0.5;\n\
\n\
gl_Position = Pmatrix*Vmatrix*Mmatrix*vec4(position, 1.);\n\
\n\
vNormal=normal;\n\
vUV=uv;\n\
}";

  var shader_fragment_source="\n\
precision mediump float;\n\
uniform sampler2D sampler, samplerShadowMap;\n\
uniform vec3 source_direction;\n\
varying vec2 vUV;\n\
varying vec3 vNormal, vLightPos;\n\
const vec3 source_ambient_color=vec3(1.,1.,1.);\n\
const vec3 source_diffuse_color=vec3(1.,1.,1.);\n\
const vec3 mat_ambient_color=vec3(0.3,0.3,0.3);\n\
const vec3 mat_diffuse_color=vec3(1.,1.,1.);\n\
const float mat_shininess=10.;\n\
\n\
void main(void) {\n\
vec2 uv_shadowMap=vLightPos.xy;\n\
\n\
//BEGIN PCF : \n\
\n\
float sum=0.;\n\
vec2 duv;\n\
for(float pcf_x=-1.5; pcf_x<=1.5; pcf_x+=1.) {\n\
for(float pcf_y=-1.5; pcf_y<=1.5; pcf_y+=1.) {\n\
duv=vec2(pcf_x/512., pcf_y/512.);\n\
sum+=texture2D(samplerShadowMap, uv_shadowMap+duv).r;\n\
}\n\
}\n\
\n\
sum/=16.;\n\
\n\
\n\
float shadowCoeff=1.-smoothstep(0.001, 0.2, vLightPos.z-sum);\n\
vec3 color=vec3(texture2D(sampler, vUV));\n\
vec3 I_ambient=source_ambient_color*mat_ambient_color;\n\
vec3 I_diffuse=source_diffuse_color*mat_diffuse_color*max(0., dot(vNormal, source_direction));\n\
\n\
vec3 I=I_ambient+shadowCoeff*I_diffuse;\n\
gl_FragColor = vec4(I*color, 1.);\n\
}";

  var get_shader=function(source, type, typeString) {
    var shader = GL.createShader(type);
    GL.shaderSource(shader, source);
    GL.compileShader(shader);
    if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
      alert("ERROR IN "+typeString+ " SHADER : " + GL.getShaderInfoLog(shader));
      return false;
    }
    return shader;
  };

  //BUILD SHADOW MAP SHADER PROGRAM
  var shader_vertex_shadowMap=get_shader(shader_vertex_source_shadowMap,
                                         GL.VERTEX_SHADER, "VERTEX SHADOW");
  var shader_fragment_shadowMap=get_shader(shader_fragment_source_shadowMap,
                                           GL.FRAGMENT_SHADER, "FRAGMENT SHADOW");

  var SHADER_PROGRAM_SHADOW=GL.createProgram();
  GL.attachShader(SHADER_PROGRAM_SHADOW, shader_vertex_shadowMap);
  GL.attachShader(SHADER_PROGRAM_SHADOW, shader_fragment_shadowMap);

  GL.linkProgram(SHADER_PROGRAM_SHADOW);
  var _PmatrixShadow = GL.getUniformLocation(SHADER_PROGRAM_SHADOW, "Pmatrix");
  var _LmatrixShadow = GL.getUniformLocation(SHADER_PROGRAM_SHADOW, "Lmatrix");
  var _positionShadow = GL.getAttribLocation(SHADER_PROGRAM_SHADOW, "position");


  //BUILD DEFAULT RENDERING SHP
  var shader_vertex=get_shader(shader_vertex_source,
                               GL.VERTEX_SHADER, "VERTEX");
  var shader_fragment=get_shader(shader_fragment_source,
                                 GL.FRAGMENT_SHADER, "FRAGMENT");

  var SHADER_PROGRAM=GL.createProgram();
  GL.attachShader(SHADER_PROGRAM, shader_vertex);
  GL.attachShader(SHADER_PROGRAM, shader_fragment);

  GL.linkProgram(SHADER_PROGRAM);

  var _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Pmatrix");
  var _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Vmatrix");
  var _Mmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Mmatrix");
  var _Lmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Lmatrix");
  var _PmatrixLight = GL.getUniformLocation(SHADER_PROGRAM, "PmatrixLight");
  var _lightDirection = GL.getUniformLocation(SHADER_PROGRAM, "source_direction");
  var _sampler = GL.getUniformLocation(SHADER_PROGRAM, "sampler");
  var _samplerShadowMap = GL.getUniformLocation(SHADER_PROGRAM,
                                                "samplerShadowMap");

  var _uv = GL.getAttribLocation(SHADER_PROGRAM, "uv");
  var _position = GL.getAttribLocation(SHADER_PROGRAM, "position");
  var _normal = GL.getAttribLocation(SHADER_PROGRAM, "normal");

  GL.useProgram(SHADER_PROGRAM);
  GL.uniform1i(_sampler, 0);
  GL.uniform1i(_samplerShadowMap, 1);
  var LIGHTDIR=[0.58,0.58,-0.58];
  GL.uniform3fv(_lightDirection, LIGHTDIR);


  /*========================= THE DRAGON ========================= */

  var CUBE_VERTEX=false, CUBE_FACES=false, CUBE_NPOINTS=0;

  LIBS.get_json("ressources/dragon.json", function(dragon){
    //vertices
    CUBE_VERTEX= GL.createBuffer ();
    GL.bindBuffer(GL.ARRAY_BUFFER, CUBE_VERTEX);
    GL.bufferData(GL.ARRAY_BUFFER,
                  new Float32Array(dragon.vertices),
      GL.STATIC_DRAW);

    //faces
    CUBE_FACES=GL.createBuffer ();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, CUBE_FACES);
    GL.bufferData(GL.ELEMENT_ARRAY_BUFFER,
                  new Uint32Array(dragon.indices),
      GL.STATIC_DRAW);

    CUBE_NPOINTS=dragon.indices.length;

    animate(0);

  });

  /*========================= THE FLOOR ========================= */

  var floor_vertices=[
    -10,0,-10,   0,1,0,   0,0, //1st point position,normal and UV
    -10,0, 10,   0,1,0,   0,1, //2nd point
    10,0, 10,   0,1,0,   1,1,
    10,0,-10,   0,1,0,   1,0
  ];

  var FLOOR_VERTEX= GL.createBuffer ();
  GL.bindBuffer(GL.ARRAY_BUFFER, FLOOR_VERTEX);
  GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(floor_vertices), GL.STATIC_DRAW);

  var FLOOR_INDICES=GL.createBuffer ();
  GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, FLOOR_INDICES);
  GL.bufferData(GL.ELEMENT_ARRAY_BUFFER,
                new Uint16Array([0,1,2, 0,2,3]),GL.STATIC_DRAW);


  /*========================= MATRIX ========================= */

  var PROJMATRIX=LIBS.get_projection(40, CANVAS.width/CANVAS.height, 1, 100);
  var MOVEMATRIX=LIBS.get_I4();
  var VIEWMATRIX=LIBS.get_I4();

  LIBS.translateZ(VIEWMATRIX, -20);
  LIBS.translateY(VIEWMATRIX, -4);
  var THETA=0,
      PHI=0;

  var PROJMATRIX_SHADOW=LIBS.get_projection_ortho(80, 1, 5, 28);
  var LIGHTMATRIX=LIBS.lookAtDir(LIGHTDIR, [0,1,0], [0,0,0]);


  /*========================= TEXTURES ========================= */
  var get_texture=function(image_URL){

    var image=new Image();

    image.src=image_URL;
    image.webglTexture=false;

    image.onload=function(e) {
      var texture=GL.createTexture();
      GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
      GL.bindTexture(GL.TEXTURE_2D, texture);
      GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, image);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
      GL.texParameteri(GL.TEXTURE_2D,
                       GL.TEXTURE_MIN_FILTER, GL.NEAREST_MIPMAP_LINEAR);
      GL.generateMipmap(GL.TEXTURE_2D);
      GL.bindTexture(GL.TEXTURE_2D, null);
      image.webglTexture=texture;
    };

    return image;
  };

  var cube_texture=get_texture("ressources/dragon.png");
  var floor_texture=get_texture("ressources/granit.jpg");

  /*======================= RENDER TO TEXTURE ======================= */

  var fb=GL.createFramebuffer();
  GL.bindFramebuffer(GL.FRAMEBUFFER, fb);

  var rb=GL.createRenderbuffer();
  GL.bindRenderbuffer(GL.RENDERBUFFER, rb);
  GL.renderbufferStorage(GL.RENDERBUFFER, GL.DEPTH_COMPONENT16 , 512, 512);

  GL.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.DEPTH_ATTACHMENT,
                             GL.RENDERBUFFER, rb);

  var texture_rtt=GL.createTexture();
  GL.bindTexture(GL.TEXTURE_2D, texture_rtt);
  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
  GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 512, 512,
                0, GL.RGBA, GL.UNSIGNED_BYTE, null);

  GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0,
                          GL.TEXTURE_2D, texture_rtt, 0);

  GL.bindTexture(GL.TEXTURE_2D, null);
  GL.bindFramebuffer(GL.FRAMEBUFFER, null);


  /*========================= DRAWING ========================= */
  GL.enable(GL.DEPTH_TEST);
  GL.depthFunc(GL.LEQUAL);
  GL.clearDepth(1.0);

  var time_old=0;
  var animate=function(time) {
    var dt=time-time_old;
    if (!drag) {
      dX*=AMORTIZATION, dY*=AMORTIZATION;
      THETA+=dX, PHI+=dY;
    }
    LIBS.set_I4(MOVEMATRIX);
    LIBS.rotateY(MOVEMATRIX, THETA);
    LIBS.rotateX(MOVEMATRIX, PHI);
    time_old=time;


    //===================== RENDER THE SHADOW MAP ==========================
    GL.bindFramebuffer(GL.FRAMEBUFFER, fb);
    GL.useProgram(SHADER_PROGRAM_SHADOW);
    GL.enableVertexAttribArray(_positionShadow);

    GL.viewport(0.0, 0.0, 512,512);
    GL.clearColor(1.0, 0.0, 0.0, 1.0); //red -> Z=Zfar on the shadow map
    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    GL.uniformMatrix4fv(_PmatrixShadow, false, PROJMATRIX_SHADOW);
    GL.uniformMatrix4fv(_LmatrixShadow, false, LIGHTMATRIX);

    //DRAW THE DRAGON
    GL.bindBuffer(GL.ARRAY_BUFFER, CUBE_VERTEX);
    GL.vertexAttribPointer(_positionShadow, 3, GL.FLOAT, false,4*(3+3+2),0) ;

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, CUBE_FACES);
    GL.drawElements(GL.TRIANGLES, CUBE_NPOINTS, GL.UNSIGNED_INT, 0);

    //DRAW THE FLOOR
    GL.bindBuffer(GL.ARRAY_BUFFER, FLOOR_VERTEX);
    GL.vertexAttribPointer(_positionShadow, 3, GL.FLOAT, false,4*(3+3+2),0) ;

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, FLOOR_INDICES);
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);

    GL.disableVertexAttribArray(_positionShadow);


    //==================== RENDER THE SCENE ===========================
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);


    GL.useProgram(SHADER_PROGRAM);


    GL.enableVertexAttribArray(_uv);
    GL.enableVertexAttribArray(_position);
    GL.enableVertexAttribArray(_normal);

    GL.viewport(0.0, 0.0, CANVAS.width, CANVAS.height);
    GL.clearColor(0.0, 0.0, 0.0, 1.0);
    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
    GL.uniformMatrix4fv(_Pmatrix, false, PROJMATRIX);
    GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);
    GL.uniformMatrix4fv(_Mmatrix, false, MOVEMATRIX);
    GL.uniformMatrix4fv(_PmatrixLight, false, PROJMATRIX_SHADOW);
    GL.uniformMatrix4fv(_Lmatrix, false, LIGHTMATRIX);

    //DRAW THE DRAGON
    if (cube_texture.webglTexture) {
      GL.activeTexture(GL.TEXTURE1);
      GL.bindTexture(GL.TEXTURE_2D, texture_rtt);
      GL.activeTexture(GL.TEXTURE0);
      GL.bindTexture(GL.TEXTURE_2D, cube_texture.webglTexture);
    }

    GL.bindBuffer(GL.ARRAY_BUFFER, CUBE_VERTEX);
    GL.vertexAttribPointer(_position, 3, GL.FLOAT, false,4*(3+3+2),0) ;
    GL.vertexAttribPointer(_normal, 3, GL.FLOAT, false,4*(3+3+2),3*4) ;
    GL.vertexAttribPointer(_uv, 2, GL.FLOAT, false,4*(3+3+2),(3+3)*4) ;

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, CUBE_FACES);
    GL.drawElements(GL.TRIANGLES, CUBE_NPOINTS, GL.UNSIGNED_INT, 0);

    //DRAW THE FLOOR
    if (floor_texture.webglTexture) {
      GL.bindTexture(GL.TEXTURE_2D, floor_texture.webglTexture);
    }

    GL.bindBuffer(GL.ARRAY_BUFFER, FLOOR_VERTEX);
    GL.vertexAttribPointer(_position, 3, GL.FLOAT, false,4*(3+3+2),0) ;
    GL.vertexAttribPointer(_normal, 3, GL.FLOAT, false,4*(3+3+2),3*4) ;
    GL.vertexAttribPointer(_uv, 2, GL.FLOAT, false,4*(3+3+2),(3+3)*4) ;

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, FLOOR_INDICES);
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);

    GL.disableVertexAttribArray(_uv);
    GL.disableVertexAttribArray(_position);
    GL.disableVertexAttribArray(_normal);

    GL.flush();
    window.requestAnimationFrame(animate);
  };
};