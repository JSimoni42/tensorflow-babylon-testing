// Tensorflow dependencies
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'; // Register WebGL backend. 
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';

import * as Babylon from '@babylonjs/core'

async function createBabylonScene(engine: Babylon.Engine, canvas: HTMLCanvasElement): Promise<Babylon.Scene> {
    const scene = new Babylon.Scene(engine)

    const camera = new Babylon.FreeCamera(
      "camera1",
      new Babylon.Vector3(0, 5, -10),
      scene
    )
    camera.setTarget(Babylon.Vector3.Zero())
    camera.attachControl(canvas, true)
  
    const light = new Babylon.HemisphericLight("light1", new Babylon.Vector3(0, 1, 0), scene)
    light.intensity = 0.7
  
    const xr = await scene.createDefaultXRExperienceAsync({
      uiOptions: {
        sessionMode: "immersive-ar",
      },
    })

    const anchorSystem = xr.baseExperience.featuresManager.enableFeature(
        Babylon.WebXRAnchorSystem,
    ) as Babylon.WebXRAnchorSystem
    const hitTest = xr.baseExperience.featuresManager.enableFeature(
        Babylon.WebXRHitTest, 
        "latest",
        { enableTransientHitTest: true, disablePermanentHitTest: true },
    ) as Babylon.WebXRHitTest
    // const domOverlay = xr.baseExperience.featuresManager.enableFeature(
    //     Babylon.WebXRDomOverlay,
    //     "latest",
    //     { element: "#dom-overlay-container" }
    // )

    return scene
}

async function detectHands(handPoseDetector: handPoseDetection.HandDetector, canvas: HTMLCanvasElement, scene: Babylon.Scene) {
    const [ estimates ] = await handPoseDetector.estimateHands(canvas, {})

    console.log(
        JSON.stringify(estimates.keypoints)
    )
}

async function main() {
    const canvas = document.querySelector("canvas")
    if (!canvas) throw new Error("Canvas elemet doesn't exist")

    const babylonEngine = await Babylon.EngineFactory.CreateAsync(canvas, {})
    const babylonScene = await createBabylonScene(babylonEngine, canvas)

    const handDetector = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        { runtime: 'tfjs' }
    )

    babylonEngine.runRenderLoop(async () => {
        await detectHands(handDetector, canvas, babylonScene)
        return babylonScene.render()
    })
    window.addEventListener('resize', () => babylonEngine.resize())
}
