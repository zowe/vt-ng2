This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
# VT App
This an App that presents a VT emulator within the Zowe UI environment, for use with VT compatible connections such as a terminal connection to USS or Unix.

**To request features or report bugs, please use the issues page at the [zlux repo](https://github.com/zowe/zlux/issues) with the terminal, app, or vt-ng2 tags**

When this App is opened in the Zowe UI by the user, it tries to connect to the default host.
This default can be changed, and is controlled by https://github.com/zowe/vt-ng2/blob/master/_defaultVT.json which is stored within the [configuration dataservice](https://github.com/zowe/zlux/wiki/Configuration-Dataservice) at runtime.

If you are running Zowe entirely on-mainframe, then the default host value of "localhost" is fine, but if you are running the zLUX server off-mainframe, then you will want to change this default when building the App, by editing \_defaultVT.json prior to deploying the App. [The App's deploy script](https://github.com/zowe/vt-ng2/blob/master/build/build.xml) can be invoked via running `ant deploy` in [zlux-build](https://github.com/zowe/zlux-build), in order to have this change take place.

This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
