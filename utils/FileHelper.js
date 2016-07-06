import fs from 'fs';

class FileHelper {

  // return undefined or content
  static async readFile ( filepath, encoding = 'utf-8' ) {
    return await new Promise( ( resolve, reject ) => {
      fs.readFile( filepath, encoding, ( err, content ) => {
        if ( err ) {
          console.log( err );
        }
        resolve( err ? undefined : content );
      } );
    } );
  }

  // return true:成功 or false:失败
  static async writeFile ( filepath, content ) {
    return await new Promise( ( resolve, reject ) => {
      fs.writeFile( filepath, content, ( err ) => {
        if ( err ) {
          console.log( err );
        }
        resolve( !err );
      } );
    } );
  }

}

export default FileHelper;
