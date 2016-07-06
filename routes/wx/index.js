import Router from 'koa-router';
import wechat from '../../utils/wx/wechat.js';

let router = new Router();

router.get( '/', async function ( ctx, next ) {
  ctx.state = {
    title: 'koa2 title'
  };
  await ctx.render( 'index', {} );
} );

wechat.api.entry.becomeDeveloper( router, '/becomeDeveloper', async ( ctx, next ) => {
  await wechat.api.message.receiveHandler.handle( ctx );
  return;
} );

export default router;
