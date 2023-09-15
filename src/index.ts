// Tensorflow dependencies
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl"; // Register WebGL backend.
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";

import * as Babylon from "@babylonjs/core";

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

function convertGLTextureToImage(
  texture: WebGLTexture,
  webGLContext: WebGL2RenderingContext,
  width: number,
  height: number,
): ImageData {
  const frameBuffer = webGLContext.createFramebuffer();
  webGLContext.bindFramebuffer(webGLContext.FRAMEBUFFER, frameBuffer);
  webGLContext.framebufferTexture2D(
    webGLContext.FRAMEBUFFER,
    webGLContext.COLOR_ATTACHMENT0,
    webGLContext.TEXTURE_2D,
    texture,
    0,
  );

  const dataArr = new Uint8ClampedArray(width * height * 4);
  webGLContext.readPixels(
    0,
    0,
    width,
    height,
    webGLContext.RGBA,
    webGLContext.UNSIGNED_BYTE,
    dataArr,
  );

  webGLContext.deleteFramebuffer(frameBuffer);

  return new ImageData(dataArr, width, height);
}

async function detectHands(
  xrSessionManager: Babylon.WebXRSessionManager,
  handDetector: handPoseDetection.HandDetector,
  currentFrame: XRFrame,
  canvas: HTMLCanvasElement,
) {
  const textChild = document.querySelector("#dom-overlay-text");
  if (!textChild) throw new Error("Could not find DOM Overlay");

  const renderingContext = canvas.getContext("webgl2");
  if (!renderingContext) throw new Error("Could not obtain rendering context");

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
      detectHands(xrSessionManager, handDetector, xrFrame, canvas),
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
    const estimationResults = await handDetector.estimateHands(imageData);

    if (estimationResults[0]) {
      textChild.textContent = `${estimationResults[0].handedness} - handedness detected`;
    } else {
      textChild.textContent = "No hands detected";
    }
  }
}

function alertOnError(func: () => Promise<void>) {
  func().catch((e) => {
    window.alert(e.message);
  });
}

async function main() {
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("Canvas elemet doesn't exist");

  const babylonEngine = await Babylon.EngineFactory.CreateAsync(canvas, {});
  const { scene: babylonScene, xr: babylonXRBase } = await createBabylonScene(
    babylonEngine,
    canvas,
  );

  babylonEngine.runRenderLoop(babylonScene.render.bind(babylonScene));
  window.addEventListener("resize", () => babylonEngine.resize());

  const handDetector = await handPoseDetection.createDetector(
    handPoseDetection.SupportedModels.MediaPipeHands,
    { runtime: "tfjs" },
  );

  const xrSessionManager = babylonXRBase.baseExperience.sessionManager;
  const xrSessionInitObserver = xrSessionManager.onXRSessionInit.addOnce(
    (xrSession) => {
      xrSession.requestAnimationFrame((timestamp, xrFrame) => {
        alertOnError(() =>
          detectHands(xrSessionManager, handDetector, xrFrame, canvas),
        );
      });
    },
  );

  xrSessionManager.onXRSessionEnded.remove(xrSessionInitObserver);
}

main().catch((e) => {
  window.alert(e.message);
});
