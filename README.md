Extension Hub
=====================================

The primary purpose of this extension is to sandbox ideas.

See the :ref:`WebExtensions AI API for reference <WebExtensions AI API>`.

Installation 
------------

1. npm install
2. npm run watch : this will kick off webpack and set up the watcher
3. npm run start : this will launch nightly with the extension installed

### If usng OpenAI
4. Add openAI key into the code in extension options panel

Tutorial
------------

### Starting the hub

This tutorial is intended to give a brief overview of creating your own extension and running it using the `extension-hub` repository. If you are already familiar with extensions and their working, the `Installation` steps above will get you what you need.

Clone the `extension-hub` repo in the usual way

```copy
git clone git@github.com:Firefox-AI/extension-hub.git
```

Install the necessary node dependencies

```
npm install
```

Build the package (Note: this may not be necessary if you are using `npm run watch` as suggested above. this command runs the build script automatically with every file change)

```
npm run build
```


Start the Nightly with the extension hub enabled. (Note: this will start the version of Nightly that you currently have installed. In order to get `wllama` to work, you need be to running Nightly 142.0a1 (2025-07-16) or higher).
```
npm run start
```

![Basic start view](assets/my-image.png)

### Running the hub with local models

Inside `src/background.ts` you will see code that calls each of the default extension types (`page_qa`, `page_summarization`, `tab_summarize`, `chat_message`): 

```
/**
 * Event Listeners
 */
browser.runtime.onMessage.addListener(
  async (message: { type: MessageTypesT; data: any }) => {
    // TODO - probably need to diversify prompts based on type of request
    const prompt = buildPrompt(message.data.prompt, message.data.textContent)

    if (message.type === 'page_qa') {
      const result = await getOpenAIResponse(prompt)
      browser.runtime.sendMessage({
        type: 'ai_result',
        result: result,
      })
    }

    if (message.type === 'page_summarize') {
      const result = await getMlEngineAIResponse(prompt)
      browser.runtime.sendMessage({
        type: 'page_summarize_result',
        result: result,
        prompt: message.data.prompt,
        url: message.data.url,
        siteName: message.data.siteName,
      })
    }

    if (message.type === 'tab_summarize') {
      const result = await summarizeTabs(prompt)
      browser.runtime.sendMessage({
        type: 'tab_summarize_result',
        result: result,
      })
    }

    if (message.type === 'chat_message') {
      const result = await getHuggingFaceChatResponse(message.data)
      browser.runtime.sendMessage({
        type: 'chat_message_result',
        result: result,
      })
    }
  }
)
```

Within each, you can see the function that is being called, along with the data being passed to it. For instance, note the result of `page_qa` is being called with `getOpenAIRessponse()`: 

```
    if (message.type === 'page_qa') {
      const result = await getOpenAIResponse(prompt)
      browser.runtime.sendMessage({
        type: 'ai_result',
        result: result,
      })
    }
```

In this tutorial, we will update this call to use a custom `getLocalPirateAIResponse` function, which will perform page QA using in a pirate voice, using a local model service. 

First - within `src/services/mlEngine.ts` add the following function:

```ts
export const getLocalPirateAIResponse = async (articleText: string, userQuestion: string) => {
  try {
    console.log("[getLocalAIResponse] called with:", { articleText, userQuestion });
    await ensureEngineIsReady()
    const trial = (browser as unknown as mlBrowserT).trial
    console.log("ENGINE READY!")

    const systemPromptAnswer = buildSystemPromptForQuestionAnswer(articleText)
    const chatInput = [
      {
        role: "system",
        content:
          `/no_think You are a friendly pirate, who is always willing to help users navigate the difficult seas of the internet. Please examine the following web page carefully and use the information found there to answer the users question. If the question cannot be answered using the page contents alone, respond by suggesting that the user perform an internet search to find the answer to their question. Do not make anything up. Always talk like a pirate. Always. \nWeb page: ${articleText}`,
      },
      {
        role: "user",
        content: 
          `${userQuestion} /no_think`,
      },
    ];

    //wllama
    const raw_result = await trial?.ml.runEngine({ prompt: chatInput, nPredict: 1500, skipPrompt: true });

    console.log(raw_result);
    const final_answer = raw_result["finalOutput"].replace("<think>\n\n</think>\n\n", "");
    
    console.log("raw result:", raw_result, typeof raw_result, final_answer);

    return final_answer
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}
```

Note: the input to this function is slightly different (it requires two strings be passed) than the input to the openAI function (which only requires 1). Also, the model that we are calling here uses the `wllama` backend, rather than `onnx`. In order to implement this new backend, we have to update the model creation function `ensureEngineIsReady`. To do this, we must update the existing `createEngine` call, which looks like this: 

```ts
const engineInfo = await trial?.ml.createEngine({
   taskName: engineMetadata.taskName || 'summarization',
   modelHub: engineMetadata.modelHub || 'huggingface',
   modelId: engineMetadata.modelId || 'Xenova/distilbart-cnn-6-6',
 })
```

to pass the arguments that `wllama` `createEngine` expects: 

```ts
await trial?.ml.createEngine({
        taskName: "text-generation",
        modelId: "QuantFactory/Qwen3-0.6B-GGUF",
        modelFile: "Qwen3-0.6B.Q4_0.gguf",
        modelHubRootUrl: "https://model-hub.mozilla.org",
        modelHubUrlTemplate: "{model}/{revision}",
        modelRevision: "main",
        numContext: 2048,
        backend: "wllama"
    });
```

when you have made these changes, your code should resemble the code in `tutorials/localPirate.ts`.

Finally, we need to change the `backgrounds.ts` script to call our new function. This can be done by importing the function using

```ts
import { getLocalPirateAIResponse } from './services/mlEngine'
```

We then need to change the listener code (which defaults to `getOpenAIResponse` to

```ts
    if (message.type === 'page_qa') {
      console.log("QA MESSAGE")
      const result = await getLocalPirateAIResponse(message.data.fullText, message.data.prompt)
      browser.runtime.sendMessage({
        type: 'ai_result',
        result: result,
      })
    }
```

Save changes, and then all that's left to do is build and deploy:

```
npm run build
npm run start
```

Once you have done this, Nightly should open with the extension hub showing. Before you can use the model, however, you have to allow the browser to download it. To do this, click the little gear icon on the upper right of the extension hub:

<>

This will open a page that looks like this

<>

Navigate to `Permissions and data` and click the button labeled `Download and run AI models on your device`.

You are all set to use your new Pirate assistant! 

One final step that can be helpful when troubleshooting: CMD+Shift+J will open the Browswer Console. Make sure that the Multiprocess radio button is clicked. This will allow you to view any logging that you create in your extension. 

Now navigate to a page and ask a question: 

<>
