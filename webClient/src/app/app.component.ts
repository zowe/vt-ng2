

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import { AfterViewInit, OnDestroy, Component, ElementRef, Input, ViewChild, Inject } from '@angular/core';
import {Http, Response} from '@angular/http';
import {Observable} from 'rxjs/Rx';
import 'rxjs/add/operator/map';

import { Angular2InjectionTokens, Angular2PluginWindowActions, Angular2PluginViewportEvents, ContextMenuItem } from 'pluginlib/inject-resources';

import {Terminal} from './terminal';
import {ConfigServiceTerminalConfig, TerminalConfig} from './terminal.config';

@Component({
  selector: 'com-rs-mvd-vt',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  @ViewChild('terminal')
  terminalElementRef: ElementRef;
  @ViewChild('terminalParent')
  terminalParentElementRef: ElementRef;
  terminal: Terminal;
  host: string;
  port: number;
  securityType: string;
  connectionSettings: any;
  terminalDivStyle: any;
  showMenu: boolean;
  
  constructor(
    private http: Http,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.VIEWPORT_EVENTS) private viewportEvents: Angular2PluginViewportEvents,
    @Inject(Angular2InjectionTokens.WINDOW_ACTIONS) private windowActions: Angular2PluginWindowActions,
    @Inject(Angular2InjectionTokens.LAUNCH_METADATA) private launchMetadata: any,
  ) {
    this.log.debug("Component Constructor");
    this.log.info('Recvd launch metadata='+JSON.stringify(launchMetadata));
    if (launchMetadata != null && launchMetadata.data) {
      switch (launchMetadata.data.type) {
      case "connect":
        if (launchMetadata.data.connectionSettings) {
          let cs = launchMetadata.data.connectionSettings;
          this.host = cs.host;
          this.port = cs.port;
          this.connectionSettings = cs;
        } else {
          
        }
      default:
        
      }
    }
    //initializations
    this.terminalDivStyle = {
      top: `14px`,
      height: `calc(100% - 14px)`
    };    
    if (!this.host) this.host = "localhost";
    if (!this.port) this.port = 23;
    if (!this.securityType) this.securityType = "0";
  }

  ngOnInit(): void {
    this.windowActions.registerCloseHandler(():Promise<void>=> {
      return new Promise((resolve,reject)=> {
        this.ngOnDestroy();
        resolve();
      });
    });
  }

  ngAfterViewInit(): void {
    let log:ZLUX.ComponentLogger = this.log;
    log.info('START: vt ngAfterViewInit');
    let dispatcher: ZLUX.Dispatcher = ZoweZLUX.dispatcher; 
    log.info("JOE.vt app comp, dispatcher="+dispatcher);
    const terminalElement = this.terminalElementRef.nativeElement;
    const terminalParentElement = this.terminalParentElementRef.nativeElement;
    this.terminal = new Terminal(terminalElement, terminalParentElement, this.http, this.pluginDefinition, this.log);
    this.viewportEvents.resized.subscribe(() => this.terminal.performResize());
    this.terminal.contextMenuEmitter.subscribe( (info) => {
      let screenContext:any = info.screenContext;
      screenContext["sourcePluginID"] = this.pluginDefinition.getBasePlugin().getIdentifier();
      log.info("app.comp subcribe lambda, dispatcher="+dispatcher);
      let recognizers:any[] = dispatcher.getRecognizers(screenContext);
      log.info("recoginzers "+recognizers);
      let menuItems:ContextMenuItem[] = [];
      for (let recognizer of recognizers){
        let action = dispatcher.getAction(recognizer);
        log.debug("JOE:recognizer="+JSON.stringify(recognizer)+" action="+action);
        if (action){
          let menuCallback = () => {
            dispatcher.invokeAction(action,info.screenContext);
          }
          // menu items can also have children
          menuItems.push({text: action.getDefaultName(), action: menuCallback});
        }
      }
      this.windowActions.spawnContextMenu(info.x, info.y, menuItems);
    });
    let rendererSettings:any = {
      fontProperties: {
        size: 14
      }
    }

    if (!this.connectionSettings) {
      this.loadConfig().subscribe((config: ConfigServiceTerminalConfig) => {
        if (config.contents.security) {
          if (config.contents.security.type === "ssh") {
            this.securityType = "1";
          } else if (config.contents.security.type === "telnet") {
            this.securityType = "0";
          }
        }
        this.host = config.contents.host;
        this.port = config.contents.port;
        this.connectionSettings = {
          host: this.host,
          port: this.port,
          security: {
            type: Number(this.securityType)
          }
        }
        this.terminal.connectToHost(rendererSettings, this.connectionSettings);
      });
    } else {
      this.terminal.connectToHost(rendererSettings, this.connectionSettings);
    }
    log.info('END: vt ngAfterViewInit');
  }

  ngOnDestroy(): void {
    this.terminal.close();
  }

  toggleMenu(state:boolean): void {
    this.showMenu = state;
    let offset = state ? 54 : 14;
    this.terminalDivStyle = {
      top: `${offset}px`,
      height: `calc(100% - ${offset}px)`
    };
    setTimeout(()=> {
      this.terminal.performResize();
    },100);
  }

  /* I expect a JSON here*/
  zluxOnMessage(eventContext: any): Promise<any> {
    return new Promise((resolve,reject)=> {
      if (!eventContext || !eventContext.data) {
        return reject('Event context missing or malformed');
      }
      switch (eventContext.data.type) {
      case 'disconnect':
        resolve(this.terminal.close());
        break;
      case 'connectionInfo':
        let hostInfo = this.terminal.virtualScreen.hostInfo;
        this.log.debug('Hostinfo='+JSON.stringify(hostInfo));
        resolve(hostInfo);
        break;
      default:
        reject('Event context missing or unknown data.type');
      };
    });    
  }


  provideZLUXDispatcherCallbacks(): ZLUX.ApplicationCallbacks {
    return {
      onMessage: (eventContext: any): Promise<any> => {
        return this.zluxOnMessage(eventContext);
      }      
    }
  }

  toggleConnection(): void {
    if (this.terminal.isConnected()) {
      this.terminal.close();
    } else {
      this.terminal.connectToHost({
          fontProperties: {
            size: 14
          }
        },
        {
          host: this.host,
          port: this.port,
          security: {
            type: Number(this.securityType)
          }
        });
    }
  }

  
  loadConfig(): Observable<ConfigServiceTerminalConfig> {
    this.log.warn("Config load is wrong and not abstracted");
    return this.http.get(ZoweZLUX.uriBroker.pluginConfigForScopeUri(this.pluginDefinition.getBasePlugin(),'instance','sessions','_defaultVT.json'))
      .map((res: Response) => res.json());
  }
}



/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

