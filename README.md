to make this work i twicked the tdameritrade api lib locally 

go to getAuthentication.js

Define a limiter in the head of the page 

const limiter = new Bottleneck({
    reservoir: 1, // initial value
    reservoirRefreshAmount: 1,
    reservoirRefreshInterval: 1800*500,
    maxConcurrent: 1,
    minTime: 0,
});

change line in  222getAuthentication function to :

return limiter.schedule(() => refreshAuthentication(authConfig, config.verbose));

this will preven reauthentication every call 