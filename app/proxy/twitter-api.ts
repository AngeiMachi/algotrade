import { TwitterApi } from 'twitter-api-v2';
// Angel Account
//bearer_token:'AAAAAAAAAAAAAAAAAAAAABmkrwEAAAAAzkBh5iHzZB3b%2BZoC9eHuDjZA7Mc%3D5oOH4YNCK2KGq9iNnnyJO4HsUV659OP5o76G2LuT4dITWSVcWn'

// const userClient = new TwitterApi({
//     appKey: '0GSLPSmmYUnmadYoWrlnX214c',
//     appSecret: 'hEJfdVMu7NnnQT4krRESes1f9Lw0VIeGP1SFsnAa831CEUFg1L',
//     // Following access tokens are not required if you are
//     // at part 1 of user-auth process (ask for a request token)
//     // or if you want a app-only client (see below)
//     accessToken: '3021538770-zt2h5LIl77GZy1aBhc1m2T0AR6elK3550EXuSZt',
//     accessSecret: '3hLb51wAVRh4uoJiGD1enmXhAeZQyNeCE6UGQFDmXbmOJ',
//   });
  
//Bot Account
//bearer_token: AAAAAAAAAAAAAAAAAAAAAIrHrwEAAAAA8le8EWfa1nMNK5Qxhi5xWfRGMR4%3D5HCVnQiyvMK2r5mD06zHE77Yk9O7Yc3webswVWEv8UPtSmSZar
const userClient = new TwitterApi({
    appKey: 'gXJHItBFpYEl2j5YX7E3XXyqV',
    appSecret: 'e0a5eel7m87RFj8O5nk6cNz4rMHBlLF0G2FJqwl7P1n01Qg0hC',
    // Following access tokens are not required if you are
    // at part 1 of user-auth process (ask for a request token)
    // or if you want a app-only client (see below)
    accessToken: '1747198737540124672-IxSdXP1EQyBMYGqQEd5mM4TFDNzgMK',
    accessSecret: '6f42cIC2wO2B12jKVOzLOO9qYVPzM3SKFkFbxcjVBBjNW',
});
export const postTweet= async (tweetText:string)=> {
    try {
        await userClient.v2.tweet({
            text: tweetText,
          });
    } catch (error) {
      console.error(`Failed to post tweet: ${error}`);
    }
}