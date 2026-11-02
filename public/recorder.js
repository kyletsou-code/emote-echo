// Records actual screen footage selected by the user, with the app's real audio.
// Nothing is uploaded; the finished WebM is downloaded to this computer.
export class DemoRecorder {
  constructor(player, onState) { this.player=player; this.onState=onState; this.recording=false; }
  async start() {
    if (this.recording) return;
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) throw new Error('Screen recording is unavailable here. Open the studio in Chrome or Edge to record.');
    await this.player.unlock();
    const display = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:30 }, audio:false });
    this.display=display;
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
      this.onState({recording:false,downloaded:true});
    };
    display.getVideoTracks()[0].onended=()=>this.stop();
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
