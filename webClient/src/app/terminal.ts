

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import 'script-loader!./../lib/js/vt.js';
import { Subject } from 'rxjs';

declare var org_zowe_terminal_vt: any;

import {Injectable} from '@angular/core';

export type TerminalWebsocketError = {
  code: number;
  reason: string;
  terminalMessage: string;
}

export class Terminal {
  virtualScreen: any;
  contextMenuEmitter: Subject<any> = new Subject();
  wsErrorEmitter: Subject<TerminalWebsocketError> = new Subject();
  
  constructor(
    private terminalElement: HTMLElement,
    private terminalParentElement: HTMLElement,
    public pluginDefinition: ZLUX.ContainerPluginDefinition,
    private log: ZLUX.ComponentLogger
  ) { }

  connectToHost(rendererSettings: any, connectionSettings: any) {
    if (this.virtualScreen) {
      return;
    }    
    const computedStyle = getComputedStyle(this.terminalElement, null);
    const width = parseInt(computedStyle.getPropertyValue('width'));
    const height = parseInt(computedStyle.getPropertyValue('height'));
    let plugin:ZLUX.Plugin = this.pluginDefinition.getBasePlugin();

    connectionSettings.url = ZoweZLUX.uriBroker.pluginWSUri(plugin, 'terminalstream', '');
    connectionSettings.connect = true;
    connectionSettings.screenWidth = "MAX";
    connectionSettings.screenHeight = "MAX";
    
    const wsErrorCallback = (wsCode: number, wsReason: string, terminalMessage: string) => {
      this.virtualScreen = null;
      this.wsErrorEmitter.next({code: wsCode, reason: wsReason, terminalMessage: terminalMessage});
    };
    
    this.virtualScreen = org_zowe_terminal_vt.startVT({parentDiv:this.terminalElement,
                                  width: width, height: height},
                                 connectionSettings,
                                 rendererSettings,
                                 {wsErrorCallback: wsErrorCallback});
   // logic for using dispatcher goes here
   // should be in vtService.js eventually
   this.virtualScreen.contextCallback = (mouseEvent, screenContext) => {
      var x = mouseEvent.offsetX;
      var y = mouseEvent.offsetY;
      mouseEvent.preventDefault();
      this.log.debug("JOE Context callback. screenID="+screenContext.screenID+" x="+x+" y="+y);
      this.log.debug("screenContext=" + JSON.stringify(screenContext, null, 2));
      this.contextMenuEmitter.next({ x: x, y: y, screenContext: screenContext});
   }
  }

  isConnected(): boolean {
    return this.virtualScreen;
  }

  
  close() {
    if (this.virtualScreen) {
      this.virtualScreen.closeConnection(4000, "Closed by user");
    }
    this.virtualScreen = null;
  }

  performResize() {
    if (this.virtualScreen) {
      this.virtualScreen.handleContainerResizeFromUI(this.terminalElement, this.virtualScreen);
    }
  }
}



/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

