import { Engine, Scene, Vector3, Matrix } from '@babylonjs/core'

export function screenToWorld(x: number, y: number, z: number, engine: Engine, scene: Scene): Vector3 {
  const renderWidth = engine.getRenderWidth()
  const renderHeight = engine.getRenderHeight()

  // These points are normalized from 0 to 1.0. They need to be denormalized.
  const screenPosition = new Vector3(
    x * renderWidth, 
    y * renderHeight, 
    z,
  )

  const vector = Vector3.Unproject(
    screenPosition,
    renderWidth,
    renderHeight,
    Matrix.Identity(),
    scene.getViewMatrix(),
    scene.getProjectionMatrix()
  )

  return vector
}

export function convertGLTextureToImage(
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
