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
    return Math.abs(Math.round(diff));
}
