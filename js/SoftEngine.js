var SoftEngine;
(function (SoftEngine){
	
	var Camera = (function () {
		function Camera() {
			this.Position = BABYLON.Vector3.Zero();
			this.Target = BABYLON.Vector3.Zero();
		}
		return Camera;
	})();
	SoftEngine.Camera = Camera;

	var Mesh =(function () {
		function Mesh(name, verticesCount, facesCount){
			this.name = name;
			this.Vertices = new Array(verticesCount);
			this.Faces = new Array(facesCount);
			this.Rotation = BABYLON.Vector3.Zero();
			this.Position = BABYLON.Vector3.Zero();
		}
		return Mesh;
	})();
	SoftEngine.Mesh = Mesh;

	var Device = (function () {
		function Device(canvas)
		{
			//NOTE : the backbuffer size is equal to the number of pixels to draw
			// on the screen (width*height) * 4 (R, G, B, Alpha values)
			this.workingCanvas = canvas;
			this.workingWidth = canvas.width;
			this.workingHeight = canvas.height;
			this.workingContext = this.workingCanvas.getContext("2d");
			this.depthbuffer = new Array(this.workingWidth * this.workingHeight);
		}
		//This function is called to clear the back buffer with a specific color
		Device.prototype.clear = function()
		{
			//Clearing with a black color by default
			this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
			//once cleared with black pixels, we're getting back the associated image 
			//data to clear out back buffer
			this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);

			//Clearing the depth buffer
			for(var i = 0; i < this.depthbuffer.length; i++){
				//Max possible value
				this.depthbuffer[i] = 10000000;
			}
		};

		//Once everything is ready, we can flush the back buffer 
		//into the front buffer
		Device.prototype.present = function()
		{
			this.workingContext.putImageData(this.backbuffer, 0, 0);
		};

		//Called to put a pixel on screen at a specific X,Y coordinates
		Device.prototype.putPixel = function(x, y, z, color)
		{
			this.backbufferdata = this.backbuffer.data;
			//As we have a 1-D array for our back buffer
			//we need to know the equivalent cell index in 1D based
			//on the 2D coordinates of the screen
			var index = ((x >> 0) + (y >> 0) * this.workingWidth); //index = width * row + col
			var index4 = index * 4;

			if(this.depthbuffer[index] < z){
				return; //Discard
			}

			this.depthbuffer[index] = z;

			//RGBA color space is used by the HTML5 canvas
			this.backbufferdata[index4] = color.r * 255;
			this.backbufferdata[index4 + 1] = color.g * 255;
			this.backbufferdata[index4 + 2] = color.b * 255;
			this.backbufferdata[index4 + 3] = color.a * 255;
		};

		//Project takes some 3D coordinates and transform them in 2D coordinates
		//using the transformation matrix
		Device.prototype.project = function(coord, transMat)
		{
			var point = BABYLON.Vector3.TransformCoordinates(coord, transMat);
			//The transformed coordinates will be based on coordinates system
			//starting on the center of the screen. But drawing on screen normally starts
			//from top left. We then need to transform them again to have x:, y: on top left
			var x = point.x * this.workingWidth + this.workingWidth / 2.0;
			//console.log(point.x * this.workingWidth + this.workingWidth / 2.0);
			var y = -point.y * this.workingHeight + this.workingHeight / 2.0;
			return (new BABYLON.Vector3(x, y, point.z));
		};

		//drawPoint call putPixel but does the clipping operation before
		Device.prototype.drawPoint = function(point, color)
		{
			//Clipping whats visible on screen
			if(point.x >= 0 && point.y >= 0 && point.x < this.workingWidth && point.y < this.workingHeight){
				//Drawing a yellow point
				this.putPixel(point.x, point.y, point.z, color);
			}
		};
		
		//Draw line between two point recursively
		Device.prototype.drawLine = function(point0, point1)
		{
			var dist = point1.subtract(point0).length();

			//If the distance between the 2 points is less than 2 pixels
			//we're exiting
			if(dist < 2)
				return;

			//Find the middle point between first & second point
			var middlePoint = point0.add((point1.subtract(point0)).scale(0.5));
			//We draw the point on screen
			this.drawPoint(middlePoint);
			//Recursive algorithm launched between first & middle point
			this.drawLine(point0, middlePoint);
			this.drawLine(middlePoint, point1);
		};

		//Draw line between two points using Bresenham's line algorithm
		//https://en.wikipedia.org/wiki/Bresenham's_line_algorithm
		Device.prototype.drawBline = function (point0, point1)
		{
			var x0 = point0.x >> 0;
			var y0 = point0.y >> 0;

			var x1 = point1.x >> 0;
			var y1 = point1.y >> 0;

			var dx = Math.abs(x1 - x0);
			var dy = Math.abs(y1 - y0);

			var sx = (x0 < x1) ? 1 : -1;
			var sy = (y0 < y1) ? 1 : -1;
			var err = dx-dy;

			while(true)
			{
				this.drawPoint(new BABYLON.Vector2(x0, y0), new BABYLON.Color4(1, 1, 0, 1));
				if((x0 == x1) && (y0 ==y1)) break;

				var e2 = 2 * err;
				if(e2 > -dy) { err -= dy; x0 += sx; }
				if(e2 < dx) { err += dx; y0 += sy ;}
			}
		};

		//The main method of the engine that re-compute each vertex projection
		// during each frame
		Device.prototype.render = function (camera, meshes)
		{
			//To understand this part, please read the prerequisites resources
			var viewMatrix = BABYLON.Matrix.LookAtLH(camera.Position, camera.Target, BABYLON.Vector3.Up());
			var projectionMatrix = BABYLON.Matrix.PerspectiveFovLH(0.78, this.workingWidth / this.workingHeight, 0.01, 1.0);

			for(var index=0; index < meshes.length; index++){
				//current mesh to work on
				var cMesh = meshes[index];
				//Beware to apply rotation before translation
				var worldMatrix = BABYLON.Matrix.RotationYawPitchRoll(
					cMesh.Rotation.x, cMesh.Rotation.y, cMesh.Rotation.z
				).multiply(
					BABYLON.Matrix.Translation(
						cMesh.Position.x, cMesh.Position.y, cMesh.Position.z
					)
				);

				var transformMatrix = worldMatrix.multiply(viewMatrix).multiply(projectionMatrix);

				/*
				//DRAWING THE VERTICES
				for(var indexVertices = 0; indexVertices < cMesh.Vertices.length; indexVertices++)
				{
					//First, we project the 3D coordinates into the 2D space
					var projectedPoint = this.project(cMesh.Vertices[indexVertices], transformMatrix);
					//The we can draw on screen
					this.drawPoint(projectedPoint, new BABYLON.Color4(0, 0, 1, 1));
				}
				*/

				//DRAWING THE FACES
				for (var indexFaces = 0; indexFaces < cMesh.Faces.length; indexFaces++) 
				{
					var currentFace = cMesh.Faces[indexFaces];
					var vertexA = cMesh.Vertices[currentFace.A];
					var vertexB = cMesh.Vertices[currentFace.B];
					var vertexC = cMesh.Vertices[currentFace.C];

					var pixelA = this.project(vertexA, transformMatrix);
					var pixelB = this.project(vertexB, transformMatrix);
					var pixelC = this.project(vertexC, transformMatrix);

					var rgb = 0.25 + ((indexFaces % cMesh.Faces.length) / cMesh.Faces.length) * 0.75;
					var color = new BABYLON.Color4(rgb, rgb, rgb, 1);
					this.drawTriangle(pixelA, pixelB, pixelC, color);
					//this.drawBline(pixelA, pixelB);
					//this.drawBline(pixelB, pixelC);
					//this.drawBline(pixelC, pixelA);
				}
			}
		};

		// Loading the JSON file in an asynchronous manner and calling
		// back with the function passer providing the array of meshes loaded
		Device.prototype.LoadJSONFileAsync = function (filename, callback)
		{
			var jsonObject = {};
			var xmlhttp = new XMLHttpRequest();
			xmlhttp.open("GET", filename, true);
			var that = this;
			xmlhttp.onreadystatechange = function() {
				if(xmlhttp.readyState == 4 && xmlhttp.status == 200){
					jsonObject = JSON.parse(xmlhttp.responseText);
					callback(that.CreateMeshesFromJSON(jsonObject));
				}
			}
			xmlhttp.send(null);
		};

		Device.prototype.CreateMeshesFromJSON = function(jsonObject)
		{
			var meshes = [];
			for(var meshIndex = 0; meshIndex < jsonObject.meshes.length; meshIndex++){
				var verticesArray = jsonObject.meshes[meshIndex].vertices;
				// Faces
				var indicesArray = jsonObject.meshes[meshIndex].indices;

				var uvCount = jsonObject.meshes[meshIndex].uvCount;
				var verticesStep = 1;

				//Depending of the number of textures coordinates per vertex
				// we're jumping in the vertices array by 6, 8 & 10 windows frame
				switch(uvCount){
					case 0:
						verticesStep = 6;
						break;
					case 1:
						verticesStep = 8;
						break;
					case 2:
						verticesStep = 10;
						break;
				}

				// the number of interesting vertices information for us
				var verticesCount = verticesArray.length / verticesStep;
				// number of faces is logically the size of the array divided by 3 (A, B, C)
				var facesCount = indicesArray.length / 3;
				var mesh = new SoftEngine.Mesh(jsonObject.meshes[meshIndex].name, verticesCount, facesCount);

				// Filling the vertices array of our mesh fist
				for(var index = 0; index < verticesCount; index++){
					var x = verticesArray[index * verticesStep];
					var y = verticesArray[index * verticesStep + 1];
					var z = verticesArray[index * verticesStep + 2];
					mesh.Vertices[index] = new BABYLON.Vector3(x, y, z);
				}

				// Then filling the Faces array
				for(var index = 0; index < facesCount; index++){
					var a = indicesArray[index * 3];
					var b = indicesArray[index * 3 + 1];
					var c = indicesArray[index * 3 + 2];
					mesh.Faces[index] = {
						A : a,
						B : b,
						C : c
					};
				}

				//Getting the position you've set in Blender
				var position = jsonObject.meshes[meshIndex].position;
				mesh.Position = new BABYLON.Vector3(position[0], position[1], position[2]);
				meshes.push(mesh);
			}
			return meshes;
		};

		//Clamping values to keep them between 0 and 1
		Device.prototype.clamp = function(value, min, max)
		{
			if(typeof min === "undefined") { min = 0; }
			if(typeof max === "undefined") { max = 1; }

			return Math.max(min, Math.min(value, max));
		};

		//Interpolating the value between 2 vertices
		// min is the starting point, max the ending point
		// and gradient the % between the 2 point
		Device.prototype.interpolate = function (min, max, gradient)
		{
			return min + (max - min) * this.clamp(gradient);
		};

		//Drawing line between 2 points from left to right
		// papb _> pcpd
		//pa, pb, pc, pd must then be sorted before
		Device.prototype.processScanLine = function (y, pa, pb, pc, pd, color)
		{
			//Thanks to current Y, we can compute the gradient to compute other values like
			//the starting X (sx) and the ending X (ex) to draw between
			// if pa.Y == pb.Y or pc.Y == pd.Y, gradient is forced to 1
			var gradient1 = pa.y != pb.y ? (y - pa.y) / (pb.y - pa.y) : 1;
			var sx = this.interpolate(pa.x, pb.x, gradient1) >> 0;

			var gradient2 = pc.y != pd.y ? (y - pc.y) / (pd.y - pc.y) : 1;
			var ex = this.interpolate(pc.x, pd.x, gradient2) >> 0;

			//starting Z & ending Z
			var z1 = this.interpolate(pa.z, pb.z, gradient1);
			var z2 = this.interpolate(pc.z, pd.z, gradient2);

			// drawing a line from left (sx) to right (ex)
			for(var x = sx; x < ex; x ++){
				var gradient = (x - sx) / (ex - sx);
				var z = this.interpolate(z1, z2, gradient);
				this.drawPoint(new BABYLON.Vector3(x, y, z), color);
			}
		};

		Device.prototype.drawTriangle = function (p1, p2, p3, color)
		{
			//Sorting the point in order to always have this order on screen p1, p2 & p3
			// with p1 always up(thus having the Y the lowest possible to be near to the top screen)	
			// then p2 between p1 & p3
			if(p2.y < p1.y){
				var temp = p1;
				p1 = p2;
				p2 = temp;
			}
			if(p3.y < p1.y){
				var temp = p1;
				p1 = p3;
				p3 = temp;
			}
			if(p3.y < p2.y){
				var temp = p2;
				p2 = p3;
				p3 = temp;
			}

			// inverse slopes
			var dP1P2; var dP1P3;
			var dP1P2 = 0;
    		var dP1P3;
			var right = false;
			var left = false;

			// http://en.wikipedia.org/wiki/Slope
    		// Computing slopes
    		if(p2.y - p1.y > 0)
				dP1P2 = (p2.x - p1.x) / (p2.y - p1.y);
			else if(p2.x > p1.x)
				right = true;
			else
				left = true;

			if(p3.y - p1.y > 0){
    			dP1P3 = (p3.x - p1.x) / (p3.y - p1.y);
    		}else{
    			dP1P3 = 0;
    		}

    		// First case where triangles with p2 on the right of p1
    		//P1
    		//  P2
    		//P3
    		if(right || (!left && dP1P2 > dP1P3)) {
    			for(var y = p1.y >> 0; y <= p3.y >> 0; y++){
    				if(y < p2.y){
    					this.processScanLine(y, p1, p3, p1, p2, color);
    				}else{
    					this.processScanLine(y, p1, p3, p2, p3, color);
    				}
    			}
    		}
    		// Second case where triangles with p2 on the left of p1
    		//   P1
    		//P2
    		//   P3
    		else{
    			for(var y = p1.y >> 0; y <= p3.y >> 0; y++){
    				if(y < p2.y){
    					this.processScanLine(y, p1, p2, p1, p3, color);
    				}else{
    					this.processScanLine(y, p2, p3, p1, p3, color);
    				}
    			}
    		}
		};

		return Device;
	})();
	SoftEngine.Device = Device;
	
})(SoftEngine || (SoftEngine = {}));