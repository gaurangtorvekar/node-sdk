import { Base } from '../../base';
import { SampleOptions, SampleResponse } from './types';

const resourceName = 'smartWallet';

export class SmartWallet extends Base {

  init(): Promise<void> {
    //execute initazation steps
    return
  }

  sampleFunc(sampleOptions: SampleOptions):SampleResponse{
    return {retArg: "sampleResponse"}
  }

}
