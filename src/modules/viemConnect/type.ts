import type {
    Abi, Address, Account, Chain, GetChain, ContractFunctionConfig,
    GetValue, Hex, FormattedTransactionRequest, SendTransactionReturnType
} from "viem"

export type IsUndefined<T> = [undefined] extends [T] ? true : false

export type UnionOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never

export type GetAccountParameter<
  TAccount extends Account | undefined = Account | undefined,
> = IsUndefined<TAccount> extends true
  ? { account: Account | Address }
  : { account?: Account | Address }


export type SendTransactionParameters<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TChainOverride extends Chain | undefined = Chain | undefined,
> = UnionOmit<
  FormattedTransactionRequest<
    TChainOverride extends Chain ? TChainOverride : TChain
  >,
  'from'
> &
  GetAccountParameter<TAccount> &
  GetChain<TChain, TChainOverride>


export type WriteContractParameters<
    TAbi extends Abi | readonly unknown[] = Abi,
    TFunctionName extends string = string,
    TChain extends Chain | undefined = Chain,
    TAccount extends Account | undefined = Account | undefined,
    TChainOverride extends Chain | undefined = Chain | undefined,
> = ContractFunctionConfig<TAbi, TFunctionName, 'payable' | 'nonpayable'> &
    GetAccountParameter<TAccount> &
    GetChain<TChain, TChainOverride> &
    UnionOmit<
        FormattedTransactionRequest<
            TChainOverride extends Chain ? TChainOverride : TChain
        >,
        'from' | 'to' | 'data' | 'value'
    > &
    GetValue<
        TAbi,
        TFunctionName,
        SendTransactionParameters<
            TChain,
            TAccount,
            TChainOverride
        > extends SendTransactionParameters
        ? SendTransactionParameters<TChain, TAccount, TChainOverride>['value']
        : SendTransactionParameters['value']
    > & {
        /** Data to append to the end of the calldata. Useful for adding a ["domain" tag](https://opensea.notion.site/opensea/Seaport-Order-Attributions-ec2d69bf455041a5baa490941aad307f). */
        dataSuffix?: Hex
    }

export type WriteContractReturnType = SendTransactionReturnType