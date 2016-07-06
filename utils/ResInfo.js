class ResInfo {

  constructor ( code = 0, msg = '', data = null ) {
    this.code = code;
    this.msg = msg;
    this.data = data;
  }

  set ( code = 0, msg = '', data = null ) {
    this.code = code;
    this.msg = msg;
    this.data = data;
  }

}

export default ResInfo;
