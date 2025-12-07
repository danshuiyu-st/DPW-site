export class GDSWriter {
    buffer: ArrayBuffer[];
    bufferLength: number;

    constructor() { this.buffer = []; this.bufferLength = 0; }
    
    addRecord(cmd: number, dataType: number, data: any = []) {
        let length = 4;
        if (dataType === 1 || dataType === 2) length += data.length * 2;
        else if (dataType === 3) length += data.length * 4;
        else if (dataType === 6) { length += data.length; if (length % 2 !== 0) length++; }
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        view.setUint16(0, length); view.setUint8(2, cmd); view.setUint8(3, dataType);
        let offset = 4;
        if (dataType === 2) { (data as number[]).forEach((val: number) => { view.setInt16(offset, val); offset += 2; }); }
        else if (dataType === 3) { (data as number[]).forEach((val: number) => { view.setInt32(offset, val); offset += 4; }); }
        else if (dataType === 6) { 
            for (let i = 0; i < data.length; i++) { view.setUint8(offset++, (data as string).charCodeAt(i)); } 
            if (length > 4 + data.length) view.setUint8(offset, 0); 
        }
        this.buffer.push(buffer); this.bufferLength += length;
    }
    
    writeHeader() { this.addRecord(0x00, 0x02, [600]); }
    writeBgnLib() { const now = new Date(); const t = [now.getFullYear(), now.getMonth()+1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()]; this.addRecord(0x01, 0x02, [...t, ...t]); }
    writeLibName(name: string) { this.addRecord(0x02, 0x06, name); }
    writeUnits() { 
        const buffer = new ArrayBuffer(20); const view = new DataView(buffer);
        view.setUint16(0, 20); view.setUint8(2, 0x03); view.setUint8(3, 0x05); 
        const u1 = [0x3E, 0x41, 0x89, 0x37, 0x4B, 0xC6, 0xA7, 0xEF]; const u2 = [0x39, 0x44, 0xB8, 0x2F, 0xA0, 0x9B, 0x5A, 0x52];
        for(let i=0; i<8; i++) view.setUint8(4+i, u1[i]); for(let i=0; i<8; i++) view.setUint8(12+i, u2[i]);
        this.buffer.push(buffer);
    }
    writeBgnStr(name: string) { const now = new Date(); const t = [now.getFullYear(), now.getMonth()+1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()]; this.addRecord(0x05, 0x02, [...t, ...t]); this.addRecord(0x06, 0x06, name); }
    
    writePath(layer: number, dataType: number, width: number, xy: number[]) {
        this.addRecord(0x09, 0x00); this.addRecord(0x0D, 0x02, [layer]); this.addRecord(0x0E, 0x02, [dataType]); 
        this.addRecord(0x21, 0x02, [0]); this.addRecord(0x0F, 0x03, [width]); this.addRecord(0x10, 0x03, xy); this.addRecord(0x11, 0x00); 
    }
    
    writeBoundary(layer: number, dataType: number, xy: number[]) { 
        this.addRecord(0x08, 0x00); this.addRecord(0x0D, 0x02, [layer]); this.addRecord(0x0E, 0x02, [dataType]); this.addRecord(0x10, 0x03, xy); this.addRecord(0x11, 0x00); 
    }
    
    writeEndStr() { this.addRecord(0x07, 0x00); }
    writeEndLib() { this.addRecord(0x04, 0x00); }
    getBlob() { return new Blob(this.buffer, { type: 'application/octet-stream' }); }
}