interface XRView {
    camera?: XRCamera
}

interface XRCamera {

}

interface XRWebGLBinding {
    getCameraImage(camera: XRCamera): any
}

namespace global {
    abstract class XRView implements XRView {}

    abstract class XRWebGLBinding implements XRWebGLBinding {}
}
