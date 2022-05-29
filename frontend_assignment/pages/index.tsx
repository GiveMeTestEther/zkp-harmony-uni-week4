import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers, utils } from "ethers"

import Head from "next/head"
import React from "react"

import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"

import { useForm } from "react-hook-form"
import styles from "../styles/Home.module.css"

type FormData = {
  name: string;
  age: string;
  address: string;
};



export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greeterEvents, setGreeterEvents] = React.useState("Listening for new greetings...")

    const { register, setValue, handleSubmit, formState: { errors } } = useForm<FormData>();
    const onSubmit = handleSubmit(data => console.log(data));


    const checkEvents = async() => {
      const provider = new providers.JsonRpcProvider("http://localhost:8545")
      const greeterContract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider)

      console.log("CHECK EVENTS TRIGGERED")
      greeterContract.on("NewGreeting", (greeting: string) => {
          console.log(utils.parseBytes32String(greeting))
          setGreeterEvents(utils.parseBytes32String(greeting))
        })
    }

    async function greet() {
        await checkEvents()

        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()

        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
        
    }
  

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <script src="https://cdn.tailwindcss.com"></script>
            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onSubmit={onSubmit} className="w-full max-w-xs mb-2">
                  <form className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2" >
                        Name
                      </label>
                      <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" type="text" placeholder="Hans"  {...register("name", { required: "Name is required" })} />
                      <small className="text-red-500 text-xs italic pl-1">
                      {errors?.name && errors.name.message}
                    </small>
                    </div>
                    <div className="mb-6">
                      <label className="block text-gray-700 text-sm font-bold mb-2" >
                        Age
                      </label>
                      <input type="number" placeholder="23" {...register("age", {required:true, min: 18, max: 99 })} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"/>
                      <small className="text-red-500 text-xs italic pl-1">
                      {errors?.age && "Age needs to be in the range of 18 to 99 years"}
                    </small>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2" >
                        Address
                      </label>
                      <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" type="text" placeholder="Mainstreet 1, New York"  {...register("address", { required: "Address is required" })} />
                      <small className="text-red-500 text-xs italic pl-1">
                      {errors?.address && errors.address.message}
                    </small>
                    </div>
                    <div className="flex items-center justify-between">
                      <button className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="button" onClick={() => {
                      onSubmit()
                     }}
                     > 
                        Submit
                      </button>
                    </div>
                  </form>
              </div>

              <div onClick={() => greet()} className={styles.button}>
                Greet
              </div>

              <div className="w-full max-w-xs mt-5">  
                <textarea id="message" readOnly value={greeterEvents} className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="Listening for new greetings..."></textarea>
              </div>
            </main>
        </div>
    )
}
