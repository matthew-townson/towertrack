/**
 * Recurrence helper functions for calendar events
 */

export function getNthWeekdayInfo(date) {
    const weekday = date.getDay(); // 0 = Sunday, 6 = Saturday
    const dayOfMonth = date.getDate();
    const nth = Math.ceil(dayOfMonth / 7);
    return { weekday, nth };
}

export function getNthWeekdayOfMonth(year, month, weekday, nth) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Find first occurrence of the weekday
    let firstOccurrence = 1 + ((weekday - firstDay.getDay() + 7) % 7);
    
    // Calculate the nth occurrence
    let targetDay = firstOccurrence + (nth - 1) * 7;
    
    // If nth is 5 (last), find the last occurrence
    if (nth === 5 || targetDay > lastDay.getDate()) {
        // Find the last occurrence
        const lastDayOfMonth = lastDay.getDate();
        const lastWeekday = lastDay.getDay();
        const daysBack = (lastWeekday - weekday + 7) % 7;
        targetDay = lastDayOfMonth - daysBack;
    }
    
    if (targetDay > lastDay.getDate() || targetDay < 1) {
        return null;
    }
    
    return new Date(year, month, targetDay);
}

export function generateRecurringInstances(event, rangeStart, rangeEnd) {
    const instances = [];
    const {
        recurrenceType,
        recurrenceInterval,
        recurrenceEndDate,
        startDate,
        endDate
    } = event;
    
    // No recurrence, return single instance
    if (!recurrenceType || recurrenceType === 'none') {
        const eventStart = new Date(startDate);
        if (eventStart >= rangeStart && eventStart <= rangeEnd) {
            return [event];
        }
        return [];
    }
    
    const baseStart = new Date(startDate);
    const baseEnd = endDate ? new Date(endDate) : null;
    const duration = baseEnd ? baseEnd.getTime() - baseStart.getTime() : 0;
    
    // Determine the actual end date for recurrence
    let recurrenceEnd = rangeEnd;
    if (recurrenceEndDate) {
        const recEnd = new Date(recurrenceEndDate);
        recEnd.setHours(23, 59, 59, 999);
        if (recEnd < recurrenceEnd) {
            recurrenceEnd = recEnd;
        }
    }
    
    // Get nth weekday info if needed
    const nthInfo = recurrenceType === 'monthly_nth' ? getNthWeekdayInfo(baseStart) : null;
    
    // Generate instances
    let currentDate = new Date(baseStart);
    let maxIterations = 1000; // Safety limit
    let iteration = 0;
    
    while (currentDate <= recurrenceEnd && iteration < maxIterations) {
        iteration++;
        
        if (currentDate >= rangeStart) {
            const instanceStart = new Date(currentDate);
            const instanceEnd = baseEnd ? new Date(instanceStart.getTime() + duration) : null;
            
            instances.push({
                ...event,
                startDate: instanceStart,
                endDate: instanceEnd,
                isRecurringInstance: true,
                originalEventId: event.id,
                instanceDate: instanceStart.toISOString().split('T')[0]
            });
        }
        
        // Move to next occurrence based on recurrence type
        switch (recurrenceType) {
            case 'daily':
                currentDate.setDate(currentDate.getDate() + recurrenceInterval);
                break;
                
            case 'weekly':
                currentDate.setDate(currentDate.getDate() + (7 * recurrenceInterval));
                break;
                
            case 'monthly':
                // Same day of month
                currentDate.setMonth(currentDate.getMonth() + recurrenceInterval);
                break;
                
            case 'monthly_nth':
                // nth weekday of month (e.g., 3rd Saturday)
                let nextMonth = currentDate.getMonth() + recurrenceInterval;
                let nextYear = currentDate.getFullYear();
                while (nextMonth > 11) {
                    nextMonth -= 12;
                    nextYear++;
                }
                const nextNthWeekday = getNthWeekdayOfMonth(
                    nextYear, 
                    nextMonth, 
                    nthInfo.weekday, 
                    nthInfo.nth
                );
                if (nextNthWeekday) {
                    // Preserve the time from original event
                    nextNthWeekday.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds());
                    currentDate = nextNthWeekday;
                } else {
                    // Skip this month if the nth weekday doesn't exist
                    currentDate.setMonth(currentDate.getMonth() + recurrenceInterval);
                }
                break;
                
            case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + recurrenceInterval);
                break;
                
            default:
                return instances;
        }
    }
    
    return instances;
}

// get description of recurrence pattern
export function getRecurrenceDescription(event) {
    const { recurrenceType, recurrenceInterval, recurrenceEndDate, startDate } = event;
    
    if (!recurrenceType || recurrenceType === 'none') {
        return 'Does not repeat';
    }
    
    const interval = recurrenceInterval || 1;
    let desc = 'Every ';
    
    if (interval > 1) {
        desc += `${interval} `;
    }
    
    switch (recurrenceType) {
        case 'daily':
            desc += interval === 1 ? 'day' : 'days';
            break;
        case 'weekly':
            desc += interval === 1 ? 'week' : 'weeks';
            break;
        case 'monthly':
            desc += interval === 1 ? 'month' : 'months';
            break;
        case 'monthly_nth': {
            const date = new Date(startDate);
            const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const ordinals = ['', '1st', '2nd', '3rd', '4th', 'last'];
            const { weekday, nth } = getNthWeekdayInfo(date);
            const ordinal = nth <= 4 ? ordinals[nth] : 'last';
            desc = `Every ${interval > 1 ? interval + ' months on the ' : ''}${ordinal} ${weekdays[weekday]}`;
            break;
        }
        case 'yearly':
            desc += interval === 1 ? 'year' : 'years';
            break;
    }
    
    if (recurrenceEndDate) {
        const endDate = new Date(recurrenceEndDate);
        desc += ` until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    
    return desc;
}
