declare enum EventsEnum {
    GROUP_AT_MESSAGE_CREATE = "GROUP_AT_MESSAGE_CREATE"
}

interface Payload {
  id:string,
  d: {
    user_id:string,
    plain_token: string;
    event_ts: string;
    group_openid: string;
    guild_id:string;
    channel_id:string;
    id: string;
    content: string;
    timestamp:string,
    target:{
      id:string,
      type:string
    },
    emoji:{
      id:string,
      type:number
    },
    author?:{
      id: string;
    },
    //  "attachments": [
    //   {
    //     "url": "x",
    //     "filename": "x.jpg",
    //     "width": 1180,
    //     "height": 1180,
    //     "size": 87741,
    //     "content_type": "image/jpeg",
    //     "content": ""
    //   }
    // ],
    attachments?:Array<{
      url: string,
      filename: string,
      width?: number,
      height?: number,
      size: number,
      content_type: string,
      content: string
    }>,
  };
  op: number;
  t: string;
}
interface DataCenter {
  name: string
  region: string
  worlds: number[]
}