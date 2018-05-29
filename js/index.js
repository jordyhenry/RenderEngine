var canvas;
var device;
var mesh;
var meshes = [];
var mera;

var divCurrentFPS;
var divAverageFPS;
var previousDate = Date.now();
var lastFPSValues = new Array(60);

document.addEventListener("DOMContentLoaded", init, false);

function init()
{
	canvas = document.getElementById("frontBuffer");
	divCurrentFPS = document.getElementById("currentFPS");
	divAverageFPS = document.getElementById("averageFPS");
	mera = new SoftEngine.Camera();
	device = new SoftEngine.Device(canvas);
	mera.Position = new BABYLON.Vector3(0, 0, 10);
	mera.Target = new BABYLON.Vector3(0, 0, 0);

	device.LoadJSONFileAsync("/mesh/monkey.babylon", loadJSONCompleted);
	//device.LoadJSONFileAsync("/mesh/sphere.babylon", loadJSONCompleted);
}

function loadJSONCompleted(meshesLoaded)
{
	meshes = meshesLoaded;
	// Calling the HTML5 rendering loop
	requestAnimationFrame(drawingLoop);
}

function measureFPS()
{
	var now = Date.now();
	var currentFPS = 1000 / (now - previousDate);
	previousDate = now;

	divCurrentFPS.textContent = currentFPS.toFixed(2);

	if(lastFPSValues.length < 60){
		lastFPSValues.push(currentFPS);
	}else{
		lastFPSValues.shift();
		lastFPSValues.push(currentFPS);
		var totalValues = 0;
		for(var i = 0; i < lastFPSValues.length; i++){
			totalValues += lastFPSValues[i];
		}

		var averageFPS = totalValues / lastFPSValues.length;
		divAverageFPS.textContent = averageFPS.toFixed(2);
	}
	
}

//Rendering loop handler
function drawingLoop()
{
	measureFPS();

	device.clear();

	for(var i  = 0; i < meshes.length; i++){
		//rotating slightly the cube during each frame rendered
		meshes[i].Rotation.x += 0.01;
		//meshes[i].Rotation.y += 0.01;
	}

	//Doing the various matrix operations
	device.render(mera, meshes);
	//Flushing the back buffer into the front buffer
	device.present();

	//Calling the HTML5 rendering loop recursively
	requestAnimationFrame(drawingLoop);
}