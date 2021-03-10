import path from "path";
import tmp from "tmp";

export async function setUpTempDirectory (): Promise<any> {
  const options = {
    unsafeCleanup: true
  };
  try {
    const tmpDir = tmp.dirSync(options);
    return {
      path: path.join(tmpDir.name, "box"),
      cleanupCallback: tmpDir.removeCallback
    };
  } catch (error) {
    console.error('Failed to unbox');
    throw error;
  }
}
