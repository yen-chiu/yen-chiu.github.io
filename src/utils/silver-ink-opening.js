// Vesper silver-ink opening: original procedural shader study, not a fluid-physics solver.
const vertex = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const fragment = `precision highp float;
uniform vec2 res;uniform float time;uniform float direction;uniform float variation;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p+2.1;a*=.52;}return s;}
void main(){vec2 uv=(gl_FragCoord.xy-.5*res)/min(res.x,res.y);float t=max(0.,time);float ca=cos(direction),sa=sin(direction);vec2 q=mat2(ca,-sa,sa,ca)*uv;
q+=vec2(.10*sin(variation*1.7),.10*cos(variation*2.3));float phase=smoothstep(.0,2.6,t);
q.x+=.24*sin(q.y*3.+t*.34);q.y+=.11*cos(q.x*4.-t*.3);
vec2 curl=vec2(fbm(q*2.5+vec2(t*.11+variation*.71,.3+variation*.29)),fbm(q*2.5+vec2(7.+variation*.43,-t*.12)));
q+=.56*(curl-.5)*phase;float n=fbm(q*5.3+vec2(t*.09+variation*.55,-t*.045));float n2=fbm(q*11.5+vec2(-t*.13,t*.08));
float wave=sin(q.x*4.3+1.7*sin(q.y*4.5)+t*.21);float plume=exp(-pow(q.x*.9+.13*sin(q.y*4.+t*.3),2.)*4.5)*exp(-pow(q.y*.73,2.)*1.7);
float filaments=smoothstep(.40,.78,n*.68+n2*.25+.15*wave)*plume;
float veins=pow(max(0.,sin((n*.8+n2*.28+q.y*.13)*40.)),9.)*plume;
float spread=smoothstep(.0,2.1,t)*smoothstep(1.5,0.05,length(uv));
float ink=(filaments*.92+veins*.22)*spread*(1.-smoothstep(5.8,7.,t));
vec3 base=vec3(.012,.016,.025);vec3 silver=mix(vec3(.20,.25,.33),vec3(.79,.83,.88),clamp(n2*.8+.15,0.,1.));
vec3 col=base+silver*ink*.9;col+=vec3(.025,.04,.065)*exp(-length(uv)*2.7)*ink;
gl_FragColor=vec4(col,1.);}`;
export function playSilverInk(canvas, signal) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  let raf = 0, stopped = false;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Shader unavailable');
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader error');
    return shader;
  };
  try {
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL link failed');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const res = gl.getUniformLocation(program, 'res');
    const time = gl.getUniformLocation(program, 'time');
    const dir = gl.getUniformLocation(program, 'direction');
    const variation = gl.getUniformLocation(program, 'variation');
    const angles = [0,1,2,3,4,5,6,7];
    let previous = -1;
    try { previous = Number(sessionStorage.getItem('vesper-ink-last-direction') ?? -1); } catch {}
    const choices = angles.filter(i => i !== previous);
    const index = choices[Math.floor(Math.random() * choices.length)];
    try { sessionStorage.setItem('vesper-ink-last-direction', String(index)); } catch {}
    const angle = index * Math.PI / 4 + (Math.random() - .5) * .22;
    gl.uniform1f(dir, angle);
    gl.uniform1f(variation, Math.random() * 20);
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 1.4);
      const scale = Math.min(1, 850 / Math.max(bounds.width, bounds.height));
      canvas.width = Math.max(1, Math.round(bounds.width * dpr * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(res, canvas.width, canvas.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const start = performance.now();
    const frame = now => {
      if (stopped || signal.aborted || document.hidden) return;
      gl.uniform1f(time, Math.min(7, (now - start) / 1000));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(raf); observer.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); }, { once: true, signal });
    signal.addEventListener('abort', stop, { once: true });
    raf = requestAnimationFrame(frame);
    return stop;
  } catch (error) {
    console.warn('Silver ink WebGL unavailable:', error);
    return null;
  }
}
