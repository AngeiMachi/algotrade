export function parseMustache(str: string, obj: any) {
    return str.replace(/{{\s*([\w\.]+)\s*}}/g, function (tag, match) {
        var nodes = match.split('.'),
            current = obj,
            length = nodes.length,
            i = 0;
        while (i < length) {
            try {
                current = current[nodes[i]];
            } catch (e) {
                return '';
            }
            i++;
        }
        return current;
    });
}

export function minuteDifference(dt2: Date, dt1: Date) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= 60;
    return Math.round(diff);
}

export function getPercentageDifference(number1:number,number2:number):number{
    const upper =Math.abs(number1-number2);
    const lower = Math.abs((number1+number2)/2);
    return (upper/lower)*100;

}