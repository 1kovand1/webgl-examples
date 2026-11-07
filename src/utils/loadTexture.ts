export function loadTexture(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
    const texture = gl.createTexture();
    const image = new Image();
    return new Promise((resolve) => {
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                image,
            );
            gl.generateMipmap(gl.TEXTURE_2D);
            resolve(texture);
        };
        image.src = url;

    });
}


export async function loadCubeTexture(gl: WebGL2RenderingContext, url: string, extension: string = "png"): Promise<WebGLTexture> {
    const texture = gl.createTexture();
    const sides = [ "left", "right","top", "bottom", "front", "back"];
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    async function loadSide(url: string, index: number) {
        const image = new Image();
        return new Promise((resolve) => {
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                gl.texImage2D(
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + index,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    image,
                );
                resolve(texture);
            };
            image.src = url;
        });
    }
    await Promise.all(sides.map((side, i) => loadSide(url + "/" + side + "." + extension, i)));
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    return texture;
}
