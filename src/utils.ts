export function alertOnError(func: () => Promise<void>) {
  func().catch((e) => {
    window.alert(e.message);
  });
}
