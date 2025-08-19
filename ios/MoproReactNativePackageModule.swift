import ExpoModulesCore

// Modify generateProof to return the full CircomProofResult structure directly
// Expo Modules should handle the serialization of the moproFFI.CircomProofResult struct
func generateProof(zkeyPath: String, circuitInputs: String) throws -> CircomProofResult {
  // Changed return type to CircomProofResult
  // No more conversion needed
  let res = try generateCircomProof(
    zkeyPath: zkeyPath, circuitInputs: circuitInputs, proofLib: ProofLib.arkworks
  )
  // Return the result directly from the FFI call
  return res
}

// --- Add Manual Conversion --- 
func convertG1ToDict(_ g1: G1) -> [String: String] {
    return ["x": g1.x, "y": g1.y, "z": g1.z]
}

func convertG2ToDict(_ g2: G2) -> [String: [String]] {
    return ["x": g2.x, "y": g2.y, "z": g2.z]
}

func convertCircomProofToDict(_ proof: CircomProof) -> [String: Any] {
    return [
        "a": convertG1ToDict(proof.a),
        "b": convertG2ToDict(proof.b),
        "c": convertG1ToDict(proof.c),
        "protocol": proof.protocol,
        "curve": proof.curve
    ]
}

func convertCircomProofResultToDict(_ result: CircomProofResult) -> [String: Any] {
    return [
        "proof": convertCircomProofToDict(result.proof),
        "inputs": result.inputs
    ]
}
// --- End Manual Conversion ---

// Helper function to parse G1 from Dictionary
func parseG1(dict: [String: Any]) throws -> G1 {
  guard let x = dict["x"] as? String,
        let y = dict["y"] as? String,
        let z = dict["z"] as? String else {
    throw MoproError.CircomError("Failed to parse G1 from dictionary")
  }
  return G1(x: x, y: y, z: z)
}

// Helper function to parse G2 from Dictionary
func parseG2(dict: [String: Any]) throws -> G2 {
  guard let x = dict["x"] as? [String],
        let y = dict["y"] as? [String],
        let z = dict["z"] as? [String] else {
    throw MoproError.CircomError("Failed to parse G2 from dictionary")
  }
  return G2(x: x, y: y, z: z)
}

// Helper function to parse CircomProof from Dictionary
func parseCircomProof(dict: [String: Any]) throws -> CircomProof {
  guard let aDict = dict["a"] as? [String: Any],
        let bDict = dict["b"] as? [String: Any],
        let cDict = dict["c"] as? [String: Any],
        let protocolStr = dict["protocol"] as? String,
        let curveStr = dict["curve"] as? String else {
    throw MoproError.CircomError("Failed to parse CircomProof fields from dictionary")
  }

  let a = try parseG1(dict: aDict)
  let b = try parseG2(dict: bDict)
  let c = try parseG1(dict: cDict)

  return CircomProof(a: a, b: b, c: c, protocol: protocolStr, curve: curveStr)
}

// Helper function to parse CircomProofResult from Dictionary
func parseCircomProofResult(dict: [String: Any]) throws -> CircomProofResult {
  guard let proofDict = dict["proof"] as? [String: Any],
        let inputs = dict["inputs"] as? [String] else {
    throw MoproError.CircomError("Failed to parse CircomProofResult fields from dictionary")
  }

  let proof = try parseCircomProof(dict: proofDict)
  return CircomProofResult(proof: proof, inputs: inputs)
}

public class MoproReactNativePackageModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('MoproReactNativePackage')` in JavaScript.
    Name("MoproReactNativePackage")

    // Sets constant properties on the module. Can take a dictionary or a closure that returns a dictionary.
    Constants([
      "PI": Double.pi
    ])

    // Defines event names that the module can send to JavaScript.
    Events("onChange")

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    Function("hello") {
      return "Hello world! 👋"
    }

    // Convert to AsyncFunction
    AsyncFunction("generateCircomProof") {
      (zkeyPath: String, circuitInputs: String) -> [String: Any] in // Return Dictionary
      // The logic remains the same, but Expo handles the async execution
      // and promise resolution/rejection based on throws.
      do {
          let proofResult = try generateProof(zkeyPath: zkeyPath, circuitInputs: circuitInputs)
          // Convert the result to a serializable Dictionary before returning
          return convertCircomProofResultToDict(proofResult)
      } catch let error as MoproError {
          print("MoproError generating proof: \(error)")
          throw Exception(name: "MoproGenerationError", description: "MoproError generating proof: \(error)")
      } catch {
          print("Unexpected error generating proof: \(error)")
          throw Exception(name: "ProofGenerationError", description: "Unexpected error generating proof: \(error.localizedDescription)")
      }
    }

    AsyncFunction("verifyProof") {
      (zkeyPath: String, proofResultDict: [String: Any]) -> Bool in
      do {
        // Parse the dictionary into the CircomProofResult struct
        let parsedProofResult = try parseCircomProofResult(dict: proofResultDict)

        // Call the verifyCircomProof function from mopro.swift
        // Using ProofLib.arkworks to match generation
        let isValid = try verifyCircomProof(
            zkeyPath: zkeyPath,
            proofResult: parsedProofResult,
            proofLib: ProofLib.arkworks
        )
        return isValid
      } catch let error as MoproError {
          print("MoproError verifying proof: \(error)")
          throw Exception(name: "MoproVerificationError", description: "MoproError verifying proof: \(error)")
      } catch {
          print("Unexpected error verifying proof: \(error)")
          throw Exception(name: "VerificationError", description: "Unexpected error verifying proof: \(error.localizedDescription)")
      }
    }

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { (value: String) in
      // Send an event to JavaScript.
      self.sendEvent(
        "onChange",
        [
          "value": value
        ])
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of the
    // view definition: Prop, Events.
    View(MoproReactNativePackageView.self) {
      // Defines a setter for the `url` prop.
      Prop("url") { (view: MoproReactNativePackageView, url: URL) in
        if view.webView.url != url {
          view.webView.load(URLRequest(url: url))
        }
      }

      Events("onLoad")
    }
  }
}
