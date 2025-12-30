import { Image, StyleSheet, Button, TextInput, View, Text } from "react-native";

import {
    generateCircomProof,
    verifyCircomProof,
    CircomProofResult,
    ProofLib,
} from "mopro-ffi";
import * as FileSystem from "expo-file-system";
import { useState } from "react";

// Path for the zkey file
const zkeyFileName = "multiplier2_final.zkey";
const zkeyFilePath = `${FileSystem.documentDirectory}${zkeyFileName}`;

export default function HomeScreen() {
    const [a, setA] = useState("");
    const [b, setB] = useState("");
    const [inputs, setInputs] = useState<string>("");
    const [proof, setProof] = useState<string>("");
    const [fullProofResult, setFullProofResult] = useState<CircomProofResult | null>(null);
    const [verificationResult, setVerificationResult] = useState<string | null>(null);
    const [generateDisabled, setGenerateDisabled] = useState(false);
    const [verifyDisabled, setVerifyDisabled] = useState(true);

    async function ensureZkeyExists() {
        const fileInfo = await FileSystem.getInfoAsync(zkeyFilePath);
        const expectedSizeBytes = 6000000; // Approx 6MB, adjust if needed

        if (!fileInfo.exists || (fileInfo.exists && fileInfo.size < expectedSizeBytes)) {
            if (fileInfo.exists) {
                 console.log(`Existing zkey file size (${fileInfo.size}) is less than expected (${expectedSizeBytes}), deleting and re-downloading...`);
                 await FileSystem.deleteAsync(zkeyFilePath, { idempotent: true });
            } else {
                console.log("Zkey file not found, downloading...");
            }

            try {
                const remoteUrl =
                    "https://github.com/zkmopro/mopro/raw/ae88356e680ac4d785183267d6147167fabe071c/test-vectors/circom/multiplier2_final.zkey";
                const downloadResult = await FileSystem.downloadAsync(
                    remoteUrl,
                    zkeyFilePath
                );
                console.log("Zkey file downloaded to:", downloadResult.uri);
                 // Optional: Add a check here for downloadResult.size if needed
            } catch (error) {
                console.error("Failed to download zkey file:", error);
                throw new Error("Failed to download zkey file.");
            }
        } else {
             console.log(`Zkey file already exists and is valid size (${fileInfo.size} bytes):`, zkeyFilePath);
        }
    }

    async function genProof(): Promise<void> {
        setGenerateDisabled(true);
        setVerificationResult(null);
        setFullProofResult(null);
        setVerifyDisabled(true);
        setProof("");
        setInputs("");

        try {
            await ensureZkeyExists();

            const circuitInputs = {
                a: [a],
                b: [b],
            };

            const res = await generateCircomProof(
                zkeyFilePath.replace("file://", ""),
                JSON.stringify(circuitInputs),
                ProofLib.Arkworks
            );

            if (!res || typeof res !== 'object' || res === null) {
                throw new Error("Native module did not return a valid proof object.");
            }

            const proofResult = res as unknown as CircomProofResult;

            console.log("Proof generated:", proofResult);
            setProof(JSON.stringify(proofResult.proof, null, 2));
            setInputs(JSON.stringify(proofResult.inputs, null, 2));
            setFullProofResult(proofResult);
            setVerifyDisabled(false);
        } catch (error) {
            console.error("Failed to generate proof:", error);
            setVerificationResult(`Proof Generation Error: ${(error as Error).message}`);
        } finally {
            setGenerateDisabled(false);
        }
    }

    async function verifyGeneratedProof(): Promise<void> {
        if (!fullProofResult) {
            setVerificationResult("No proof available to verify.");
            return;
        }
        setVerifyDisabled(true);
        setVerificationResult("Verifying...");

        try {
            const isValid = await verifyCircomProof(
                zkeyFilePath.replace("file://", ""),
                fullProofResult,
                ProofLib.Arkworks
            );
            console.log("Verification result:", isValid);
            setVerificationResult(`Verification ${isValid ? "Successful" : "Failed"}`);
        } catch (error) {
            console.error("Failed to verify proof:", error);
            setVerificationResult(`Verification Error: ${(error as Error).message}`);
        } finally {
            setVerifyDisabled(false);
        }
    }

    return (
        <View style={{ padding: 50 }}>
            <Text style={styles.title}>Mopro Circom Example</Text>
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Input A:</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter value for a"
                    value={a}
                    onChangeText={setA}
                    keyboardType="numeric"
                />
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Input B:</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter value for b"
                    value={b}
                    onChangeText={setB}
                    keyboardType="numeric"
                />
            </View>
            <View style={styles.buttonContainer}>
                <Button
                    title="Generate Proof"
                    disabled={generateDisabled}
                    onPress={genProof}
                />
                <Button
                    title="Verify Proof"
                    disabled={verifyDisabled}
                    onPress={verifyGeneratedProof}
                />
            </View>
             {verificationResult && (
                <Text style={styles.outputTitle}>Verification Result:</Text>
             )}
             {verificationResult && (
                 <Text
                     style={[
                         styles.output,
                         verificationResult.startsWith("Verification Successful") ? styles.success :
                         verificationResult.includes("Error") || verificationResult.startsWith("Verification Failed") ? styles.error : {}
                     ]}
                 >
                     {verificationResult}
                 </Text>
             )}
            <View style={styles.stepContainer}>
                <Text style={styles.outputTitle}>Generated Inputs:</Text>
                <Text style={styles.output}>{inputs || "Press 'Generate Proof'"}</Text>
                <Text style={styles.outputTitle}>Generated Proof:</Text>
                <Text style={styles.output}>{proof || "(Proof data will appear here)"}</Text>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    stepContainer: {
        gap: 8,
        marginTop: 20,
    },
    input: {
        height: 40,
        borderColor: "gray",
        borderWidth: 1,
        flex: 1,
        paddingHorizontal: 10,
        marginLeft: 10,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    label: {
        fontSize: 16,
        width: 60,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 20,
    },
    outputTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
    },
    output: {
        fontSize: 14,
        borderColor: "lightgray",
        borderWidth: 1,
        padding: 10,
        marginTop: 5,
        backgroundColor: '#f9f9f9',
        fontFamily: 'monospace',
    },
     success: {
         color: 'green',
         fontWeight: 'bold',
     },
     error: {
         color: 'red',
         fontWeight: 'bold',
     }
});
