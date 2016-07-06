import Crypto from 'crypto';

// 加密器
class Encryptor {

  // md5算法(不是标准算法),返回32个字符
  static md5 ( str ) {
    let md5 = Crypto.createHash( 'md5' );
    md5.update( str );
    return md5.digest( 'hex' );
  }

  // 安全散列算法(Secure Hash Algorithm),返回40个字符
  static sha1 ( str ) {
    let sha1 = Crypto.createHash( 'sha1' );
    sha1.update( str );
    return sha1.digest( 'hex' );
  }

  // 增强的加密,先sha1,再md5,返回32个字符
  static strong ( str ) {
    return this.md5( this.sha1( str ) );
  }

}

export default Encryptor;