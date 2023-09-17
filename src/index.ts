import * as mediaPipe from "@mediapipe/tasks-vision"
import * as Babylon from "@babylonjs/core";

import { alertOnError } from './utils'
import { convertGLTextureToImage, screenToWorld } from './babylon-utils'

async function createBabylonScene(
  engine: Babylon.Engine,
  canvas: HTMLCanvasElement,
) {
  const scene = new Babylon.Scene(engine);

  const camera = new Babylon.FreeCamera(
    "camera1",
    new Babylon.Vector3(0, 5, -10),
    scene,
  );
  camera.setTarget(Babylon.Vector3.Zero());
  camera.attachControl(canvas, true);

  const light = new Babylon.HemisphericLight(
    "light1",
    new Babylon.Vector3(0, 1, 0),
    scene,
  );
  light.intensity = 0.7;

  const xr = await scene.createDefaultXRExperienceAsync({
    uiOptions: {
      sessionMode: "immersive-ar",
      requiredFeatures: [
        // Babylon.WebXRFeatureName.ANCHOR_SYSTEM,
        // Babylon.WebXRFeatureName.HIT_TEST,
        "dom-overlay",
        "camera-access",
      ],
    },
  });

  // const anchorSystem = xr.baseExperience.featuresManager.enableFeature(
  //     Babylon.WebXRAnchorSystem,
  //     undefined,
  //     undefined,
  //     undefined,
  //     true
  // ) as Babylon.WebXRAnchorSystem
  // const hitTest = xr.baseExperience.featuresManager.enableFeature(
  //     Babylon.WebXRHitTest,
  //     "latest",
  //     { enableTransientHitTest: true, disablePermanentHitTest: true },
  //     undefined,
  //     true,
  // ) as Babylon.WebXRHitTest

  xr.baseExperience.featuresManager.enableFeature(
    Babylon.WebXRDomOverlay,
    "latest",
    { element: "#dom-overlay-container" },
  );

  return { scene, xr };
}

let addedPoints = false

async function handDetectionLoop(
  xrSessionManager: Babylon.WebXRSessionManager,
  handDetector: mediaPipe.HandLandmarker,
  currentFrame: XRFrame,
  renderingContext: WebGL2RenderingContext,
  babylonScene: Babylon.Scene,
  babylonEngine: Babylon.Engine,
) {
  const textChild = document.querySelector("#dom-overlay-text");
  if (!textChild) throw new Error("Could not find DOM Overlay");

  const referenceSpace = xrSessionManager.referenceSpace;

  let xrCamera: XRCamera | undefined = undefined;
  const viewerPose = currentFrame.getViewerPose(referenceSpace);
  for (const view of viewerPose?.views ?? []) {
    if (view.camera) {
      xrCamera = view.camera;
      continue;
    }
  }

  xrSessionManager.session.requestAnimationFrame((time, xrFrame) => {
    alertOnError(() =>
      handDetectionLoop(xrSessionManager, handDetector, xrFrame, renderingContext, babylonScene, babylonEngine),
    );
  });

  if (!xrCamera) return;

  const xrWebGLBinding = new XRWebGLBinding(
    xrSessionManager.session,
    renderingContext,
  );
  const cameraImage = xrWebGLBinding.getCameraImage(xrCamera);
  if (cameraImage) {
    const imageData = convertGLTextureToImage(
      cameraImage,
      renderingContext,
      xrCamera.width,
      xrCamera.height,
    );
    const estimationResults = handDetector.detect(imageData)
    const [ handPoints ] = estimationResults.landmarks

    if (handPoints) {
      addedPoints = true
      addPointsToScene(babylonScene, babylonEngine, getPointsOfInterest(handPoints))
    }
  }
}

type NamedLandmark = mediaPipe.NormalizedLandmark & { name: string }
function getPointsOfInterest(landmarks: mediaPipe.NormalizedLandmark[]): NamedLandmark[] {
  const targetInterestingLandmarks = [
    // { idx: 8, name: 'INDEX_FINGER_TIP' }, 
    // { idx: 7, name: 'INDEX_FINGER_DIP' }, 
    // { idx: 6, name: 'INDEX_FINGER_PIP' },
    { idx: 0, name: 'WRIST' },
  ]

  return targetInterestingLandmarks.map((targetLandmark) => {
    return {
      name: targetLandmark.name,
      ...landmarks[targetLandmark.idx],
    }
  })
}

function addPointsToScene(scene: Babylon.Scene, engine: Babylon.Engine, landmarks: NamedLandmark[]) {
  for(const landmark of landmarks) {
    const transformedCoordinates = screenToWorld(landmark.x, landmark.y, landmark.z, engine, scene)

    const dot = scene.getMeshByName(landmark.name)  ??
      Babylon.CreateSphere(landmark.name, {
        diameter: 0.25,
      }, scene)

    dot.position = transformedCoordinates
  }
}

async function main() {
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("Canvas element doesn't exist");

  const babylonEngine = await Babylon.EngineFactory.CreateAsync(canvas, {});
  const { scene: babylonScene, xr: babylonXRBase } = await createBabylonScene(
    babylonEngine,
    canvas,
  );

  babylonEngine.runRenderLoop(babylonScene.render.bind(babylonScene));
  window.addEventListener("resize", () => babylonEngine.resize());

  const visionModel = await mediaPipe.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm")
  const mediaPipeHandDetection = await mediaPipe.HandLandmarker.createFromOptions(
    visionModel,
    { numHands: 1, }
  )

  const xrSessionManager = babylonXRBase.baseExperience.sessionManager;
  const xrSessionInitObserver = xrSessionManager.onXRSessionInit.addOnce(
    (xrSession) => {
      xrSession.requestAnimationFrame((timestamp, xrFrame) => {
        const canvasContext = canvas.getContext("webgl2");
        if (!canvasContext) throw new Error("Cannot get canvas context");

        alertOnError(() =>
          handDetectionLoop(xrSessionManager, mediaPipeHandDetection, xrFrame, canvasContext, babylonScene, babylonEngine),
        );
      });
    },
  );

  xrSessionManager.onXRSessionEnded.remove(xrSessionInitObserver);
}

main().catch((e) => {
  window.alert(e.message);
});
