import { Injectable } from '@nestjs/common';
import { loadAppConfig, type AppConfig } from '@triageflow/config';

@Injectable()
export class AppConfigService {
  readonly values: AppConfig;

  constructor() {
    this.values = loadAppConfig();
  }
}
