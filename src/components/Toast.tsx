import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
export interface ToastData { id:number; message:string; variant:'error'|'warning'|'success'|'info'; persistent?:boolean }
interface Props { toast:ToastData|null; dismiss:()=>void }
export default function Toast({toast,dismiss}:Props) {
  useEffect(()=>{if(!toast||toast.persistent)return;const t=window.setTimeout(dismiss,5000);return()=>clearTimeout(t);},[toast,dismiss]);
  if(!toast)return null;
  const Icon=toast.variant==='success'?CheckCircle2:toast.variant==='info'?Info:AlertCircle;
  return <div className={`toast glass toast-${toast.variant}`} role={toast.variant==='error'?'alert':'status'}><Icon size={17}/><span>{toast.message}</span><button onClick={dismiss} aria-label="Dismiss message"><X size={15}/></button></div>;
}
