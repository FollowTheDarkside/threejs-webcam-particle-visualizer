window.addEventListener('load', init); // Wait for loading
window.addEventListener('resize', onResize); // When window resized

let renderer, scene, camera;
let webCam;
let particles;

function init() {  
    // Get window size
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Create webgl renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#myCanvas'),
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(windowWidth, windowHeight);
    // renderer.outputEncoding = THREE.GammaEncoding;

    // Create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
    const controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    camera.position.set( 0, 20, 0 );
    controls.update(); // must be called after any manual changes to the camera's transform
    scene.add(camera);

    // Create light
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.0);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    scene.add(directionalLight);

    // Init webcam & particle
    // getDevices()
    initWebCam();

    // Render loop
    const render = () => {
        drawParticles();
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
}

// Get videoinput device info
function getDevices(){
    console.log("getDevices...");
    navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
        devices.forEach(function(device) {
            if(device.kind == "videoinput"){
                console.log("device:",device);
            }
        });
    })
    .catch(function(err) {
        console.error('ERROR:', err);
    });
}

function initWebCam(){
    console.log("initWebCam...");
    webCam = document.createElement('video');
    webCam.id = 'webcam';
    webCam.autoplay = true;
    webCam.width    = 640;
    webCam.height   = 480;

    const option = {
        video: true,
        // video: {
        //     deviceId: "hogehoge",
        //     width: { ideal: 1280 },
        //     height: { ideal: 720 }
        // },
        audio: false,
    }

    // Get image from camera
    media = navigator.mediaDevices.getUserMedia(option)
    .then(function(stream) {
        webCam.srcObject = stream;
        createParticles();
    }).catch(function(e) {
        alert("ERROR: " + e.message);
        // console.error('ERROR:', e.message);
    });
}

function getImageData(image){

    const w = image.width;
    const h = image.height;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = w;
    canvas.height = h;

    // // Invert image
    // ctx.translate(w, 0);
    // ctx.scale(-1, 1);

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);

    return imageData
}

function createParticles(){
    console.log("createParticles...");
    const imageData = getImageData(webCam);

    const geometry = new THREE.BufferGeometry();
    const vertices_base = [];
    const colors_base = [];

    const width = imageData.width;
    const height = imageData.height;

    // Set particle info
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const posX = 0.03*(-x + width / 2);
            const posY = 0; //0.1*(-y + height / 2)
            const posZ = 0.03*(y - height / 2);
            vertices_base.push(posX, posY, posZ);

            const r = 1.0;
            const g = 1.0;
            const b = 1.0;
            colors_base.push(r, g, b);
        }
    }
    const vertices = new Float32Array(vertices_base);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const colors = new Float32Array(colors_base);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Set shader material
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: {
                type: 'f',
                value: 0.0
            },
            size: {
                type: 'f',
                value: 5.0
            },
            // texture: {
            //     type: 't',
            //     value: hoge
            // }
        },
        vertexShader: vertexSource,
        fragmentShader: fragmentSource,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function drawParticles(t){
    // Update particle info
    if (particles) {
        const imageData = getImageData(webCam);
        const length = particles.geometry.attributes.position.count;
        for (let i = 0; i < length; i++) {
            const index = i * 4;
            const r = imageData.data[index]/255;
            const g = imageData.data[index+1]/255;
            const b = imageData.data[index+2]/255;
            const gray = (r+g+b) / 3;

            particles.geometry.attributes.position.setY( i , gray*10);
            particles.geometry.attributes.color.setX( i , r);
            particles.geometry.attributes.color.setY( i , g);
            particles.geometry.attributes.color.setZ( i , b);
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.color.needsUpdate = true;
    }
}

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

//===================================================
// Shader Souce
//===================================================

const vertexSource = `
attribute vec3 color;
uniform float time;
uniform float size;
varying vec3 vColor;
varying float vGray;
void main() {
    // To fragmentShader
    vColor = color;
    vGray = (vColor.x + vColor.y + vColor.z) / 3.0;

    // Set vertex size
    gl_PointSize = size * vGray * 3.0;
    // gl_PointSize = size;

    // Set vertex position
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

const fragmentSource = `
varying vec3 vColor;
varying float vGray;
void main() {
    float gray = vGray;

    // Decide whether to draw particle
    if(gray > 0.5){
        gray = 0.0;
    }else{
        gray = 1.0;
    }

    // Set vertex color
    gl_FragColor = vec4(vColor, gray);
}
`;