// src/components/ErrorBoundary.tsx
import React from "react";
export class ErrorBoundary extends React.Component<{children: React.ReactNode},{hasError:boolean;error?:any}>{
  constructor(p:any){super(p);this.state={hasError:false};}
  static getDerivedStateFromError(error:any){return {hasError:true,error};}
  render(){
    if(this.state.hasError){
      return <div className="container-xxl py-5">
        <h1 className="h5">Une erreur est survenue</h1>
        <pre className="small bg-light p-3 rounded overflow-auto">{String(this.state.error)}</pre>
      </div>;
    }
    return this.props.children;
  }
}
