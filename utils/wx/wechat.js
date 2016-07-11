import path from 'path';
import request from 'request';
import Encryptor from '../Encryptor.js';
import FileHelper from '../FileHelper.js';
import xml2js from 'xml2js';
import getRawBody from 'raw-body';
import fs from 'fs';

let wechat = {

    // 测试号 [
    appId: 'wx52a1ba727422089f',
    appSecret: '2b4f1581d8920c036918c38a4afb7809 ',
    openId: 'gh_bcaa9c88affa',
    // ]

    // 订阅号 [
    // appId: 'wx24389f24cc2a3024',
    // appSecret: 'd6546ed562fb9d67d16a174ac2360e18 ',
    // openId: 'gh_502a9182100b',
    // ]

    token: 'maod',
    access_token_file_path: path.join(__dirname, '../../wechat-access-token.txt'),

    storage: {},

};

// 这里只是提前定义，好给下面用：`${ Wechat.api.url.prefix }xxxxxx`
wechat.api = {url: {prefix: 'https://sz.api.weixin.qq.com/cgi-bin'}};

wechat.api = {
    url: {
        prefix: wechat.api.url.prefix,
        entry: {
            getAccessToken: `${ wechat.api.url.prefix }/token?grant_type=client_credential&appid=${ wechat.appId }&secret=${ wechat.appSecret }`,
        },
        message: {},
        material: {
            temporary: {
                upload: `${ wechat.api.url.prefix }/media/upload`,
            },
            permanent: {},
        },
        user: {
            tag: {
                create: `${ wechat.api.url.prefix }/tags/create`,
                findAll: `${ wechat.api.url.prefix }/tags/get`,
                update: `${ wechat.api.url.prefix }/tags/update`,
                delete: `${ wechat.api.url.prefix }/tags/delete`,
            },
            // 查找多个用户，根据标签id
            findOpenIdsByTagId: `${ wechat.api.url.prefix }/user/tag/get`,
            // 给多个用户打标签
            taggingMore: `${ wechat.api.url.prefix }/tags/members/batchtagging`,
            // 给多个用户取消标签
            untaggingMore: `${ wechat.api.url.prefix }/tags/members/batchuntagging`,
            // 查找某个用户所有的标签
            findOneTagIds: `${ wechat.api.url.prefix }/tags/getidlist`,
            // 给某个用户备注
            remarkOne: `${ wechat.api.url.prefix }/user/info/updateremark`,
            // 查找某个用户的基本信息
            findOneBaseInfo: `${ wechat.api.url.prefix }/user/info`,
            // 查找多个用户的基本信息
            findMoreBaseInfo: `${ wechat.api.url.prefix }/user/info/batchget`,
            // 查找多个用户
            findMore: `${ wechat.api.url.prefix }/user/get`,
        },
    },
    entry: {
        becomeDeveloper: (router, url = '', cb = () => {}) => {
            router.get(url, (ctx, next) => {
                let str = Encryptor.sha1([wechat.token, ctx.query.timestamp, ctx.query.nonce].sort().join(''));
                ctx.body = str === ctx.query.signature ? ctx.query.echostr : 'Error.';
            });
            router.post(url, cb);
        },
        getAccessToken: async () => {
            let data = await FileHelper.readFile(wechat.access_token_file_path);
            if (data !== undefined) {
                data = JSON.parse(data);
                if (wechat.api.entry.isValidAccessToken(data)) {
                    return data.access_token;
                }
            }
            return (await wechat.api.entry.updateAccessToken()).access_token;
        },
        saveAccessToken: async (data = {}) => {
            return await FileHelper.writeFile(wechat.access_token_file_path, JSON.stringify(data));
        },
        updateAccessToken: async () => {
            let data = await new Promise((resolve, reject) => {
                request.post(wechat.api.url.entry.getAccessToken, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let data = JSON.parse(body);
                        let now = new Date().getTime();
                        data.expires_in = now + (data.expires_in - 20) * 1000;
                        resolve(data);
                    }
                });
            });
            if (await wechat.api.entry.saveAccessToken(data)) {
                return data;
            }
        },
        isValidAccessToken: (data = {}) => {
            if (!data.access_token || !data.expires_in) {
                return false;
            }
            return new Date().getTime() < data.expires_in;
        },
    },
    message: {
        getReqDataFrom: async (ctx) => {
            return await new Promise(async (resolve, reject) => {
                xml2js.parseString(await getRawBody(ctx.req), {explicitArray: false}, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data.xml);
                    }
                });
            });
        },
        receiveHandler: {
            handle: async (ctx) => {
                wechat.storage.ctx = ctx;
                wechat.storage.reqMsg = await wechat.api.message.getReqDataFrom(wechat.storage.ctx);
                console.log('reqMsg:', wechat.storage.reqMsg);
                if (wechat.storage.reqMsg.MsgType === 'event') {
                    if (wechat.storage.reqMsg.Event === 'subscribe') {
                        wechat.api.message.receiveHandler.subscribeHandle();
                    }
                    else if (wechat.storage.reqMsg.Event === 'unsubscribe') {
                        wechat.api.message.receiveHandler.unsubscribeHandle();
                    }
                }
                else if (wechat.storage.reqMsg.MsgType === 'text') {
                    await wechat.api.message.receiveHandler.textHandle();
                }
                else if (wechat.storage.reqMsg.MsgType === 'image') {
                    wechat.api.message.receiveHandler.imgHandle();
                }
                else if (wechat.storage.reqMsg.MsgType === 'voice') {
                    wechat.api.message.receiveHandler.voiceHandle();
                }
                else if (wechat.storage.reqMsg.MsgType === 'video') {
                    wechat.api.message.receiveHandler.videoHandle();
                }
                else if (wechat.storage.reqMsg.MsgType === 'shortvideo') {
                    wechat.api.message.receiveHandler.shortVideoHandle();
                }
                else if (wechat.storage.reqMsg.MsgType === 'location') {
                    wechat.api.message.receiveHandler.locationHandle();
                }
                else if (wechat.storage.reqMsg.MsgType === 'link') {
                    wechat.api.message.receiveHandler.linkHandle();
                }
            },
            subscribeHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: 'Hi~ 归谷的童鞋,你好!!'
                });
            },
            unsubscribeHandle: () => {
                console.log(`用户[${ wechat.storage.reqMsg.FromUserName }]已取消关注。`);
            },
            textHandle: async () => {
                let content = wechat.storage.reqMsg.Content;
                if (content === '0') {
                    wechat.api.message.replyer.replyImgTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        articles: [
                            {
                                title: '坚持就是胜利',
                                description: '就是一个描述而已。',
                                picUrl: 'http://img.mukewang.com/5774ec7200012eb112000460.jpg',
                                url: 'http://www.baidu.com'
                            },
                            {
                                title: '心灵鸡汤',
                                description: '真的。。。',
                                picUrl: 'http://img.mukewang.com/5775caee0001fe5a12000460.jpg',
                                url: 'http://imooc.com'
                            },
                        ]
                    });
                }
                else if (content === '1') {
                    let result = await wechat.api.material.temporary.upload('image', path.join(__dirname, '../../public/images/wx/logo.jpg'));
                    wechat.api.message.replyer.replyImgMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        mediaId: result.media_id
                    });
                }
                else if (content === '2') {
                    wechat.api.message.replyer.replyVideoMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        mediaId: 'Rz3OW5jN6BriLJfOow3cC4d-AobX51pr2j9si4lkSlJyRGEuxhNJImxANjhAP1eY',
                        title: '敲啊敲敲啊敲',
                        description: '下班了好激动啊'
                    });
                }
                else if (content === '3') {
                    let result = await wechat.api.material.temporary.upload('image', path.join(__dirname, '../../public/images/wx/0.jpg'));
                    wechat.api.message.replyer.replyMusicMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        title: '音乐文件-动次打次',
                        description: '放松一下',
                        musicUrl: 'http://mpge.5nd.com/2015/2015-9-12/66325/1.mp3',
                        hqMusicUrl: '',
                        thumbMediaId: result.media_id
                    });
                }
                else if (content === '4') {
                    // await wechat.api.user.tag.create( '广东深圳' );
                    // await wechat.api.user.tag.update( 2, '广东深圳' );
                    // console.log( await wechat.api.user.tag.findAll() );
                    // await wechat.api.user.tag.delete( 2 );
                    // console.log( await wechat.api.user.tag.findAll() );
                    // console.log( await wechat.api.user.findOpenIdsByTagId( 2 ) );
                    // console.log( await wechat.api.user.findOneBaseInfo( 'olXq3vzt-VM4jFt-4G3cf57IwRzY' ) );
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '肆'
                    });
                }
                else if (content === '5') {
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '伍'
                    });
                }
                else if (content === '6') {
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '陆'
                    });
                }
                else if (content === '7') {
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '柒'
                    });
                }
                else if (content === '8') {
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '捌'
                    });
                }
                else if (content === '9') {
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '玖'
                    });
                }
                else {
                    wechat.api.message.replyer.replyTextMsg({
                        toUserName: wechat.storage.reqMsg.FromUserName,
                        content: '文本消息。'
                    });
                }
            },
            imgHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: '图片消息。'
                });
            },
            voiceHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: '语音消息。'
                });
            },
            videoHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: '视频消息。'
                });
            },
            shortVideoHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: '小视频消息。'
                });
            },
            locationHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: '地理位置消息。'
                });
            },
            linkHandle: () => {
                wechat.api.message.replyer.replyTextMsg({
                    toUserName: wechat.storage.reqMsg.FromUserName,
                    content: '链接消息。'
                });
            },
        },
        replyer: {
            replyTextMsg: ({toUserName, content} = {}) => {
                wechat.storage.ctx.status = 200;
                wechat.storage.ctx.type = 'application/xml';
                wechat.storage.ctx.body = `
                    <xml>
                        <ToUserName><![CDATA[${ toUserName }]]></ToUserName>
                        <FromUserName><![CDATA[${ wechat.openId }]]></FromUserName>
                        <CreateTime>${ new Date().getTime() }</CreateTime>
                        <MsgType><![CDATA[text]]></MsgType>
                        <Content><![CDATA[${ content }]]></Content>
                    </xml>
                `.trim();
            },
            replyImgMsg: ({toUserName, mediaId} = {}) => {
                wechat.storage.ctx.status = 200;
                wechat.storage.ctx.type = 'application/xml';
                wechat.storage.ctx.body = `
                    <xml>
                        <ToUserName><![CDATA[${ toUserName }]]></ToUserName>
                        <FromUserName><![CDATA[${ wechat.openId }]]></FromUserName>
                        <CreateTime>${ new Date().getTime() }</CreateTime>
                        <MsgType><![CDATA[image]]></MsgType>
                        <Image>
                            <MediaId><![CDATA[${ mediaId }]]></MediaId>
                        </Image>
                    </xml>
                `.trim();
            },
            replyVoiceMsg: ({toUserName, mediaId} = {}) => {
                wechat.storage.ctx.status = 200;
                wechat.storage.ctx.type = 'application/xml';
                wechat.storage.ctx.body = `
                    <xml>
                        <ToUserName><![CDATA[${ toUserName }]]></ToUserName>
                        <FromUserName><![CDATA[${ wechat.openId }]]></FromUserName>
                        <CreateTime>${ new Date().getTime() }</CreateTime>
                        <MsgType><![CDATA[voice]]></MsgType>
                        <Voice>
                            <MediaId><![CDATA[${ mediaId }]]></MediaId>
                        </Voice>
                    </xml>
                `.trim();
            },
            replyVideoMsg: ({toUserName, mediaId, title, description} = {}) => {
                wechat.storage.ctx.status = 200;
                wechat.storage.ctx.type = 'application/xml';
                wechat.storage.ctx.body = `
                    <xml>
                        <ToUserName><![CDATA[${ toUserName }]]></ToUserName>
                        <FromUserName><![CDATA[${ wechat.openId }]]></FromUserName>
                        <CreateTime>${ new Date().getTime() }</CreateTime>
                        <MsgType><![CDATA[video]]></MsgType>
                        <Video>
                            <MediaId><![CDATA[${ mediaId }]]></MediaId>
                            <Title><![CDATA[${ title }]]></Title>
                            <Description><![CDATA[${ description }]]></Description>
                        </Video>
                    </xml>
                `.trim();
            },
            replyMusicMsg: ({toUserName, title, description, musicUrl, hqMusicUrl, thumbMediaId} = {}) => {
                wechat.storage.ctx.status = 200;
                wechat.storage.ctx.type = 'application/xml';
                wechat.storage.ctx.body = `
                    <xml>
                        <ToUserName><![CDATA[${ toUserName }]]></ToUserName>
                        <FromUserName><![CDATA[${ wechat.openId }]]></FromUserName>
                        <CreateTime>${ new Date().getTime()}</CreateTime>
                        <MsgType><![CDATA[music]]></MsgType>
                        <Music>
                            <Title><![CDATA[${ title }]]></Title>
                            <Description><![CDATA[${ description }]]></Description>
                            <MusicUrl><![CDATA[${ musicUrl }]]></MusicUrl>
                            <HQMusicUrl><![CDATA[${ hqMusicUrl }]]></HQMusicUrl>
                            <ThumbMediaId><![CDATA[${ thumbMediaId }]]></ThumbMediaId>
                        </Music>
                    </xml>
                `.trim();
            },
            // 参数articles传值范例： articles: [ {title, description, picUrl, url}, {title, description, picUrl, url} ]
            replyImgTextMsg: ({toUserName, articles} = {}) => {
                wechat.storage.ctx.status = 200;
                wechat.storage.ctx.type = 'application/xml';
                wechat.storage.ctx.body = `
                    <xml>
                        <ToUserName><![CDATA[${ toUserName }]]></ToUserName>
                        <FromUserName><![CDATA[${ wechat.openId }]]></FromUserName>
                        <CreateTime>${ new Date().getTime() }</CreateTime>
                        <MsgType><![CDATA[news]]></MsgType>
                        <ArticleCount>${ articles.length }</ArticleCount>
                        <Articles>
                            ${
                                ((() => {
                                    return articles.map((article) => {
                                        return `
                            <item>
                                <Title><![CDATA[${ article.title }]]></Title> 
                                <Description><![CDATA[${ article.description }]]></Description>
                                <PicUrl><![CDATA[${ article.picUrl }]]></PicUrl>
                                <Url><![CDATA[${ article.url }]]></Url>
                            </item>
                                        `.trim();
                                    }).join('');
                                })())
                            }
                        </Articles>
                    </xml>
                `.trim();
            },
        },
    },
    material: {
        temporary: {
            upload: async (type, filepath) => {
                let accessToken = await wechat.api.entry.getAccessToken();
                let url = `${ wechat.api.url.material.temporary.upload }?access_token=${ accessToken }&type=${ type }`;
                return await new Promise((resolve, reject) => {
                    request.post(url, {formData: {media: fs.createReadStream(filepath)}}, (err, res, body) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(JSON.parse(body));
                        }
                    });
                });
            }
        },
        permanent: {},
    },
    user: {
        tag: {
            create: async (name) => {
                let accessToken = await wechat.api.entry.getAccessToken();
                let url = `${ wechat.api.url.user.tag.create }?access_token=${ accessToken }`;
                let form = {
                    tag: {
                        name: name,
                    },
                };
                return await new Promise((resolve, reject) => {
                    request.post(url, {form: form}, (err, res, body) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(JSON.parse(body).tag);
                        }
                    });
                });
            },
            findAll: async () => {
                let accessToken = await wechat.api.entry.getAccessToken();
                let url = `${ wechat.api.url.user.tag.findAll }?access_token=${ accessToken }`;
                return await new Promise((resolve, reject) => {
                    request.get(url, (err, res, body) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(JSON.parse(body).tags);
                        }
                    });
                });
            },
            update: async (id, name) => {
                let accessToken = await wechat.api.entry.getAccessToken();
                let url = `${ wechat.api.url.user.tag.update }?access_token=${ accessToken }`;
                let form = {
                    tag: {
                        id: id,
                        name: name,
                    },
                };
                return await new Promise((resolve, reject) => {
                    request.post(url, {form: form}, (err, res, body) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(JSON.parse(body).errcode === 0);
                        }
                    });
                });
            },
            delete: async (id) => {
                let accessToken = await wechat.api.entry.getAccessToken();
                let url = `${ wechat.api.url.user.tag.delete }?access_token=${ accessToken }`;
                let form = {
                    tag: {
                        id: id,
                    },
                };
                return await new Promise((resolve, reject) => {
                    request.post(url, {form: form}, (err, res, body) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(JSON.parse(body).errcode === 0);
                        }
                    });
                });
            },
        },
        // 查找openId集，根据标签id
        findOpenIdsByTagId: async (tagId) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.findOpenIdsByTagId }?access_token=${ accessToken }`;
            let form = {
                tagid: tagId,
            };
            return await new Promise((resolve, reject) => {
                request.post(url, {form: form}, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let result = JSON.parse(body);
                        if (result.errcode) {
                            resolve(undefined);
                        }
                        else {
                            resolve(result.data.openid);
                        }
                    }
                });
            });
        },
        // 给多个用户打标签, return true or false.
        taggingMore: async (openIds, tagId) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.taggingMore }?access_token=${ accessToken }`;
            let form = {
                openid_list: openIds,
                tagid: tagId
            };
            return await new Promise((resolve, reject) => {
                request.post(url, {form: form}, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(JSON.parse(body).errcode === 0);
                    }
                });
            });
        },
        // 给多个用户取消标签, return true or false.
        untaggingMore: async (openIds, tagId) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.untaggingMore }?access_token=${ accessToken }`;
            let form = {
                openid_list: openIds,
                tagid: tagId
            };
            return await new Promise((resolve, reject) => {
                request.post(url, {form: form}, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(JSON.parse(body).errcode === 0);
                    }
                });
            });
        },
        // 查找某个用户所有的标签, return tagIds or undefined.
        findOneTagIds: async (openId) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.findOneTagIds }?access_token=${ accessToken }`;
            let form = {
                openid: openId,
            };
            return await new Promise((resolve, reject) => {
                request.post(url, {form: form}, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let result = JSON.parse(body);
                        if (result.errcode) {
                            resolve(undefined);
                        }
                        else {
                            resolve(result.tagid_list);
                        }
                    }
                });
            });
        },
        // 给某个用户备注, return true or false.
        remarkOne: async (openId, remark) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.remarkOne }?access_token=${ accessToken }`;
            let form = {
                openid: openId,
                remark: remark,
            };
            return await new Promise((resolve, reject) => {
                request.post(url, {form: form}, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(JSON.parse(body).errcode === 0);
                    }
                });
            });
        },
        // 查找某个用户的基本信息
        findOneBaseInfo: async (openId) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.findOneBaseInfo }?access_token=${ accessToken }&openid=${ openId }`;
            return await new Promise((resolve, reject) => {
                request.get(url, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let result = JSON.parse(body);
                        if (result.errcode) {
                            resolve(undefined);
                        }
                        else {
                            resolve(result);
                        }
                    }
                });
            });
        },
        // 查找多个用户的基本信息
        findMoreBaseInfo: async (openIds) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.findMoreBaseInfo }?access_token=${ accessToken }`;
            let form = {
                user_list: openIds.map((openId) => {
                    return {openid: openId};
                }),
            };
            return await new Promise((resolve, reject) => {
                request.post(url, {form: form}, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let result = JSON.parse(body);
                        if (result.errcode) {
                            resolve(undefined);
                        }
                        else {
                            resolve(result.user_info_list);
                        }
                    }
                });
            });
        },
        // 查找多个用户, return {"total":2,"count":2,"openIds":["","OPENID1","OPENID2"],"nextOpenId":"NEXT_OPENID"} or undefined;
        findMore: async (nextOpenId) => {
            let accessToken = await wechat.api.entry.getAccessToken();
            let url = `${ wechat.api.url.user.findMore }?access_token=${ accessToken }&next_openid=${ nextOpenId }`;
            return await new Promise((resolve, reject) => {
                request.get(url, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let result = JSON.parse(body);
                        if (result.errcode) {
                            resolve(undefined);
                        }
                        else {
                            resolve({
                                total: result.total,
                                count: result.count,
                                openIds: result.data.openid,
                                nextOpenId: result.next_openid,
                            });
                        }
                    }
                });
            });
        },
    },
};

export default wechat;
