interface XRView {
    camera?: XRCamera
}

interface XRCamera {
    width: number;
    height: number;
}

interface XRWebGLBinding {
    getCameraImage(camera: XRCamera): WebGLTexture | null
}

namespace global {
    abstract class XRView implements XRView {}

    abstract class XRWebGLBinding implements XRWebGLBinding {}
}
