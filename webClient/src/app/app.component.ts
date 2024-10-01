

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { AfterViewInit, OnDestroy, Component, ElementRef, Input, ViewChild, Inject, Optional } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

import { Angular2InjectionTokens, Angular2PluginWindowActions, Angular2PluginViewportEvents, ContextMenuItem } from 'pluginlib/inject-resources';

import {Terminal, TerminalWebsocketError} from './terminal';
import {ConfigServiceTerminalConfig, TerminalConfig, ZssConfig} from './terminal.config';

import './app.component.css';

const TOGGLE_MENU_BUTTON_PX = 16; //with padding
const CONFIG_MENU_ROW_PX = 40;
const CONFIG_MENU_PAD_PX = 4;
const CONFIG_MENU_SIZE_PX = CONFIG_MENU_ROW_PX+CONFIG_MENU_PAD_PX; //40 per row, plus 2 px padding

enum ErrorType {
  host,
  port,
  config,
  websocket
}

class ErrorState {
  private stateArray: Array<string|null> = new Array<string|null>();

  set(type: ErrorType, message: string|null) {
    this.stateArray[type] = message;
  }

  get(type:ErrorType): string|null {
    return this.stateArray[type];
  }

  clear(): void {
    this.stateArray.fill(null);
  }

  //should it block connection
  isStateBlocking(): boolean {
    if (this.stateArray[ErrorType.host] || this.stateArray[ErrorType.port]){
      return true;
    }
    return false;
  }


  getFirstError(): string|null {
    for (let i = 0; i < this.stateArray.length; i++) {
      if (this.stateArray[i]) {
        return this.stateArray[i];
      }
    }
    return null;
  }
}

@Component({
  selector: 'com-rs-mvd-vt',
  templateUrl: './app.component.html'
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
  errorMessage: string = '';
  terminalDivStyle: any;
  showMenu: boolean;
  private terminalHeightOffset: number = 0;
  private currentErrors: ErrorState = new ErrorState();
  disableButton: boolean;
  private savedSettings: TerminalConfig;

  constructor(
    private http: HttpClient,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.VIEWPORT_EVENTS) private viewportEvents: Angular2PluginViewportEvents,
    @Optional() @Inject(Angular2InjectionTokens.WINDOW_ACTIONS) private windowActions: Angular2PluginWindowActions,
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
    this.adjustTerminal(TOGGLE_MENU_BUTTON_PX);

    //defaulting initializations
    if (!this.host) this.host = "localhost";
    if (!this.port) this.port = 23;
    if (!this.securityType) this.securityType = "0";
  }

  ngOnInit(): void {
    if (this.windowActions) {
      this.windowActions.setTitle(`VT - Disconnected`);
    }
    this.viewportEvents.registerCloseHandler(():Promise<void>=> {
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
    this.terminal = new Terminal(terminalElement, terminalParentElement, this.pluginDefinition, this.log);
    this.viewportEvents.resized.subscribe(() => this.terminal.performResize());
    if (this.windowActions) {
      this.terminal.contextMenuEmitter.subscribe( (info) => {
        let screenContext:any = info.screenContext;
        screenContext["sourcePluginID"] = this.pluginDefinition.getBasePlugin().getIdentifier();
        log.info("app.comp subcribe lambda, dispatcher="+dispatcher);
        let recognizers:any[] = dispatcher.getRecognizers(screenContext);
        log.info("recoginzers "+recognizers);
        let menuItems:ContextMenuItem[] = [];
        for (let recognizer of recognizers){
          let action = dispatcher.getAction(recognizer);
          log.debug("Recognizer="+JSON.stringify(recognizer)+" action="+action);
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
    }
    let rendererSettings:any = {
      fontProperties: {
        size: 14
      }
    }
    this.terminal.wsErrorEmitter.subscribe((error: TerminalWebsocketError)=> this.onWSError(error));
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
        this.checkZssProxy().then(() => {
          this.connectionSettings = {
            host: this.host,
            port: this.port,
            security: {
              type: Number(this.securityType)
            }
          }
        this.connectAndSetTitle(rendererSettings, this.connectionSettings);
        });
      }, (error)=> {
        if (error.status && error.statusText) {
          this.setError(ErrorType.config, `Config load status=${error.status}, text=${error.statusText}`);
        } else {
          this.log.warn(`Config load error=${error}`);
          this.setError(ErrorType.config, `Unknown config load error. Check browser log`);
        }
      });
    } else {
      this.connectAndSetTitle(rendererSettings, this.connectionSettings);
    }
    log.info('END: vt ngAfterViewInit');
  }

  ngOnDestroy(): void {
    this.terminal.close();
  }

  private onWSError(error: TerminalWebsocketError): void {
    let message = "Terminal closed due to websocket error. Code="+error.code;
    this.log.warn(message+", Reason="+error.reason);
    this.setError(ErrorType.websocket, message);
    this.disconnectAndUnsetTitle();
  }

  private setError(type: ErrorType, message: string):void {
    this.currentErrors.set(type, message);
    this.refreshErrorBar();
  }

  private clearError(type: ErrorType):void {
    let hadError = this.currentErrors.get(type);
    this.currentErrors.set(type, null);
    if (hadError) {
      this.refreshErrorBar();
    }
  }

  private clearAllErrors():void {
    this.currentErrors.clear();
    if (this.errorMessage.length > 0) {
      this.refreshErrorBar();
    }
  }

  private refreshErrorBar(): void {
    let error = this.currentErrors.getFirstError();

    let hadError = this.errorMessage.length > 0;
    if (error) {
      this.errorMessage = error;
      this.disableButton = this.currentErrors.isStateBlocking() ? true : false;
    } else {
      this.errorMessage = '';
      this.disableButton = false;
    }

    if ((error && !hadError) || (!error && hadError)) {
      let offset: number = error ? CONFIG_MENU_ROW_PX : -CONFIG_MENU_ROW_PX;
      this.adjustTerminal(offset);
    }
  }

  toggleMenu(state:boolean): void {
    this.showMenu = state;
    this.adjustTerminal(state ? CONFIG_MENU_SIZE_PX : -CONFIG_MENU_SIZE_PX);
  }

  private adjustTerminal(heightOffsetPx: number): void {
    this.terminalHeightOffset += heightOffsetPx;
    this.terminalDivStyle = {
      top: `${this.terminalHeightOffset}px`,
      height: `calc(100% - ${this.terminalHeightOffset}px)`
    };
    if (this.terminal) {
      setTimeout(()=> {
        this.terminal.performResize();
      },100);
    }
  }

  /* I expect a JSON here*/
  zluxOnMessage(eventContext: any): Promise<any> {
    return new Promise((resolve,reject)=> {
      if (!eventContext || !eventContext.data) {
        return reject('Event context missing or malformed');
      }
      switch (eventContext.data.type) {
      case 'disconnect':
        resolve(this.disconnectAndUnsetTitle());
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

  checkZssProxy(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.host === "") {
        this.loadZssSettings().subscribe((zssSettings: ZssConfig) => {
          this.host = zssSettings.zssServerHostName;
          resolve(this.host);
        }, () => {
          this.setError(ErrorType.host, "Invalid Hostname: \"" + this.host + "\".")
          reject(this.host)
        });
      } else {
        resolve(this.host);
      }
    });
  }

  toggleConnection(): void {
    if (this.terminal.isConnected()) {
      this.disconnectAndUnsetTitle();
    } else {
      this.clearAllErrors(); //reset due to user interaction
      this.connectAndSetTitle({
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

  private disconnectAndUnsetTitle() {
    this.terminal.close();
    if (this.windowActions) {this.windowActions.setTitle(`VT - Disconnected`);}
  }

  private connectAndSetTitle(rendererSettings: any, connectionSettings:any) {
    if (this.windowActions) {
      this.windowActions.setTitle(`VT - ${connectionSettings.host}:${connectionSettings.port}`);
    }
    this.terminal.connectToHost(rendererSettings, connectionSettings);
  }

  //identical to isConnected for now, unless there's another reason to disable input
  get isInputDisabled(): boolean {
    return this.terminal.isConnected();
  }

  get isConnected(): boolean {
    return this.terminal.isConnected();
  }

  get powerButtonColor(): string {
    if (this.disableButton) {
      return "#bf3030";
    } else if (this.isConnected) {
      return "#17da38";
    } else {
      return "#b9b9b9";
    }
  }

  validatePort(): void {
    if (this.port < 0 || this.port > 65535 || !Number.isInteger(this.port)) {
      this.setError(ErrorType.port, `Port missing or invalid`);
    } else {
      this.clearError(ErrorType.port);
    }
  }

  validateHost(): void {
    if (!this.host) {
      this.setError(ErrorType.host, `Host missing or invalid`);
    } else {
      this.clearError(ErrorType.host);
    }
  }

  loadConfig(): Observable<ConfigServiceTerminalConfig> {
    this.log.warn("Config load is wrong and not abstracted");
    return this.http.get<ConfigServiceTerminalConfig>(ZoweZLUX.uriBroker.pluginConfigForScopeUri(this.pluginDefinition.getBasePlugin(),'user','sessions','_defaultVT.json'));
  }

  loadZssSettings(): Observable<ZssConfig> {
    return this.http.get<ZssConfig>(ZoweZLUX.uriBroker.serverRootUri("server/proxies"));
  }


  saveSettings() {
    let securityType = this.securityType == "1" ? "ssh" : "telnet";
    this.http.put(ZoweZLUX.uriBroker.pluginConfigForScopeUri(this.pluginDefinition.getBasePlugin(), 'user', 'sessions', '_defaultVT.json'),
      {
        security: {
          type: securityType
        },
        port: this.port,
        host: this.host,
      }
    ).subscribe((res) => this.log.debug('Save returned'));
  }
}



/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
