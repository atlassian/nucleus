/// <reference path="../../typings/index.d.ts" />

interface Application {
  name: string;
}

interface UserSubState {
  user?: User;
  signedIn: boolean;
}

interface AppSubState extends Application {}
type AppsSubState = NucleusApp[];
interface MigrationSubState {
  items: NucleusMigration[];
  hasPendingMigration: boolean;
}

interface AppState {
  user: UserSubState;
  apps: AppsSubState;
  base: string;
  migrations: MigrationSubState;
}

declare module '*.scss' {
  const content: {
    [className: string]: string;
  };
  export = content;
}

declare module '*.css' {
  const content: undefined;
  export = content;
}

declare module '*.png' {
  const content: string;
  export = content;
}

declare module '@atlaskit/field-base' {
  const foo: any;
  export const Label: any;
  export default foo;
}

declare module '@atlaskit/multi-select' {
  export const MultiSelectStateless: any;
}

declare module '@atlaskit/field-text' {
  const foo: any;
  export const FieldTextStateless: any;
  export default foo;
}