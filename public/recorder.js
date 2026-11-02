// Records actual screen footage selected by the user, with the app's real audio.
// Nothing is uploaded; the finished WebM is downloaded to this computer.
export class DemoRecorder {
  constructor(player, onState) { this.player=player; this.onState=onState; this.recording=false; this.selecting=false; }
  async choose() {
    if (this.recording || this.selecting) return;
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) throw new Error('Screen recording is unavailable here. Open the studio in Chrome or Edge to record.');
    this.selecting=true; this.onState({selecting:true});
    for(const track of this.display?.getTracks()||[])track.stop();
    this.display=null;
    try {
      // Request capture while the click's user activation is still available.
      const capture=navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:false});
      const unlock=this.player.unlock();
      const display=await capture; await unlock;
      this.display=display;
      display.getVideoTracks()[0].onended=()=>{
        if(this.recording)this.stop();
        else {this.display=null;this.onState({ready:false});}
      };
      this.onState({ready:true,stream:display});
    } catch(error) {this.onState({ready:false});throw error;}
    finally {this.selecting=false;}
  }
  async start() {
    if (this.recording) return;
    if (!this.display?.getVideoTracks().some(track=>track.readyState==='live')) throw new Error('Choose a window and check its preview first.');
    await this.player.unlock();
    const display=this.display;
    const audio=this.player.create().createMediaStreamDestination();
    this.player.analyser.connect(audio);
    this.audio=audio;
    const stream = new MediaStream([...display.getVideoTracks(),...audio.stream.getAudioTracks()]);
    const mimeType=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    this.recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:2_500_000});
    const chunks=[];
    this.recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    this.recorder.onstop=()=>{
      const blob=new Blob(chunks,{type:this.recorder.mimeType||'video/webm'});
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url;link.download=this.recorder.mimeType.startsWith('video/mp4')?'emote-echo-demo.mp4':'emote-echo-demo.webm';link.hidden=true;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60_000);
      this.display=null;this.onState({recording:false,downloaded:true});
    };
    this.startedAt=Date.now();this.recording=true;
    this.recorder.start(1000);
    this.timer=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-this.startedAt)/1000);
      this.onState({recording:true,elapsed});
      if(elapsed>=175)this.stop();
    },250);
    this.onState({recording:true,elapsed:0});
  }
  stop() {
    if(!this.recording)return;
    this.recording=false;clearInterval(this.timer);
    if(this.recorder.state!=='inactive')this.recorder.stop();
    for(const track of this.display.getTracks())track.stop();
    try{this.player.analyser.disconnect(this.audio);}catch{}
  }
}
